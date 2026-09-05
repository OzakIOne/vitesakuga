// oxlint-disable effecttsgo/global-date -- test fixtures need explicit Date seeds for `readAt` rows
import { Effect } from "effect";
import { sql, type Kysely } from "kysely";
import { afterEach, describe, expect, it } from "vitest";

import { makeAuthSession } from "../auth/session.fixture";
import type { DB } from "../db/kysely";
import { toIsoTimestamp } from "../db/schema/timestamp";
import { makeServiceTestLayer } from "../db/test-utils";
import {
  NotificationsService,
  NotificationsServiceLive,
  type NotificationType,
} from "./notifications.service";

let closeCtx: (() => Promise<void>) | undefined;

afterEach(async () => {
  await closeCtx?.();
  closeCtx = undefined;
});

const insertUser = async (db: Kysely<DB>, id: string) => {
  await db
    .insertInto("user")
    .values({
      email: `${id}@test.com`,
      id,
      name: id,
      username: id.toLowerCase(),
    })
    .execute();
};

const insertNotification = async (
  db: Kysely<DB>,
  args: {
    userId: string;
    type: NotificationType;
    postId?: number;
    readAt?: Date;
    createdAt?: Date;
  },
) => {
  const row = await db
    .insertInto("notifications")
    .values({
      ...(args.createdAt === undefined ? {} : { createdAt: args.createdAt }),
      ...(args.postId === undefined ? {} : { postId: args.postId }),
      ...(args.readAt === undefined ? {} : { readAt: args.readAt }),
      type: args.type,
      userId: args.userId,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row;
};

const notificationRows = async (db: Kysely<DB>) =>
  db.selectFrom("notifications").selectAll().orderBy("id", "asc").execute();

describe("NotificationsService.notifyOrLog", () => {
  it("inserts a row with the deep link and one without", async () => {
    const ctx = await makeServiceTestLayer(NotificationsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await insertUser(db, "user-1");

    await runEffect(
      Effect.gen(function* () {
        const svc = yield* NotificationsService;
        yield* svc.notifyOrLog({
          postId: 42,
          type: "promotion-approved",
          userId: "user-1",
        });
        yield* svc.notifyOrLog({
          type: "promotion-rejected",
          userId: "user-1",
        });
      }),
    );

    const rows = await notificationRows(db);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      postId: 42,
      readAt: null,
      type: "promotion-approved",
      userId: "user-1",
    });
    expect(rows[1]).toMatchObject({
      postId: null,
      readAt: null,
      type: "promotion-rejected",
      userId: "user-1",
    });
  });

  it("swallows a SqlError and resolves undefined without writing a row", async () => {
    const ctx = await makeServiceTestLayer(NotificationsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await insertUser(db, "user-1");
    // Break the write while the (unused here) inbox reads stay intact.
    await sql`ALTER TABLE notifications DROP COLUMN type`.execute(db);

    await expect(
      runEffect(
        Effect.gen(function* () {
          const svc = yield* NotificationsService;
          return yield* svc.notifyOrLog({
            type: "comment-mention",
            userId: "user-1",
          });
        }),
      ),
    ).resolves.toBeUndefined();

    // Restore the column so the (empty) inbox can be inspected.
    await sql`ALTER TABLE notifications ADD COLUMN type text NOT NULL`.execute(
      db,
    );
    expect(await notificationRows(db)).toHaveLength(0);
  });
});

describe("NotificationsService.list", () => {
  it("returns at most 50 rows, newest first", async () => {
    const ctx = await makeServiceTestLayer(NotificationsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect, mockGetSession } = ctx;
    await insertUser(db, "user-1");
    const ids: number[] = [];
    // Explicit spaced createdAt values: `defaultNow()` can collapse
    // back-to-back inserts into identical timestamps, which would leave
    // ties to Postgres' unstable sort.
    for (let i = 0; i < 55; i++) {
      const row = await insertNotification(db, {
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 0, i)),
        type: "comment-mention",
        userId: "user-1",
      });
      ids.push(row.id);
    }
    mockGetSession.mockResolvedValue(makeAuthSession({ id: "user-1" }));

    const rows = await runEffect(NotificationsService.list());

    expect(rows).toHaveLength(50);
    expect(rows.map((row) => row.id)).toEqual([...ids].reverse().slice(0, 50));
    for (const [i, row] of rows.slice(0, -1).entries()) {
      expect((rows[i + 1] ?? row).createdAt <= row.createdAt).toBe(true);
    }
  });

  it("converts timestamps to ISO strings", async () => {
    const ctx = await makeServiceTestLayer(NotificationsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect, mockGetSession } = ctx;
    await insertUser(db, "user-1");
    await insertNotification(db, {
      readAt: new Date("2026-01-15T10:00:00.000Z"),
      type: "comment-mention",
      userId: "user-1",
    });
    await insertNotification(db, { type: "comment-mention", userId: "user-1" });
    mockGetSession.mockResolvedValue(makeAuthSession({ id: "user-1" }));

    const rows = await runEffect(NotificationsService.list());

    expect(rows).toHaveLength(2);
    const readRow = rows.find((row) => row.readAt !== null);
    const unreadRow = rows.find((row) => row.readAt === null);
    expect(readRow).toBeDefined();
    expect(unreadRow).toBeDefined();
    for (const row of rows) {
      expect(typeof row.createdAt).toBe("string");
      expect(row.createdAt.endsWith("Z")).toBe(true);
    }
    // The stored instant round-trips unchanged into the ISO string (PGlite
    // returns naive `timestamp` columns in local time, so compare against
    // the stored Date, not a hardcoded UTC literal).
    const stored = await db.selectFrom("notifications").selectAll().execute();
    const storedRead = stored.find((row) => row.readAt !== null);
    expect(storedRead).toBeDefined();
    if (readRow && storedRead) {
      expect(storedRead.readAt).not.toBeNull();
      expect(readRow.readAt).toBe(toIsoTimestamp(storedRead.readAt!));
      expect(readRow.createdAt).toBe(toIsoTimestamp(storedRead.createdAt));
    }
  });

  it("never returns another user's rows", async () => {
    const ctx = await makeServiceTestLayer(NotificationsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect, mockGetSession } = ctx;
    await insertUser(db, "user-a");
    await insertUser(db, "user-b");
    const ownIds = [
      (
        await insertNotification(db, {
          type: "comment-mention",
          userId: "user-a",
        })
      ).id,
      (
        await insertNotification(db, {
          type: "promotion-approved",
          userId: "user-a",
        })
      ).id,
    ];
    for (const _ of [1, 2, 3]) {
      await insertNotification(db, {
        type: "comment-mention",
        userId: "user-b",
      });
    }
    mockGetSession.mockResolvedValue(makeAuthSession({ id: "user-a" }));

    const rows = await runEffect(NotificationsService.list());

    expect(rows.map((row) => row.id).sort()).toEqual(ownIds.sort());
  });

  it("fails with UnauthorizedError when signed out", async () => {
    const ctx = await makeServiceTestLayer(NotificationsServiceLive);
    closeCtx = ctx.close;
    const { runEffect, mockGetSession } = ctx;
    mockGetSession.mockResolvedValue(null);

    const error = await runEffect(Effect.flip(NotificationsService.list()));

    expect(error._tag).toBe("UnauthorizedError");
    expect(error.message).toBe(
      "You must be logged in to read your notifications",
    );
  });
});

describe("NotificationsService.markAllRead", () => {
  it("flips readAt on every unread row of the session user only", async () => {
    const ctx = await makeServiceTestLayer(NotificationsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect, mockGetSession } = ctx;
    await insertUser(db, "user-a");
    await insertUser(db, "user-b");
    await insertNotification(db, { type: "comment-mention", userId: "user-a" });
    await insertNotification(db, { type: "comment-mention", userId: "user-a" });
    await insertNotification(db, {
      readAt: new Date("2026-01-01T00:00:00.000Z"),
      type: "comment-mention",
      userId: "user-a",
    });
    await insertNotification(db, { type: "comment-mention", userId: "user-b" });
    // Snapshot the already-read instant before the update so the assertion
    // proves the row was untouched (PGlite returns naive `timestamp`
    // columns in local time, so no hardcoded UTC literal).
    const readBefore = await db
      .selectFrom("notifications")
      .selectAll()
      .where("readAt", "is not", null)
      .executeTakeFirstOrThrow();
    mockGetSession.mockResolvedValue(makeAuthSession({ id: "user-a" }));

    await runEffect(NotificationsService.markAllRead());

    const rows = await notificationRows(db);
    const [firstUnread, secondUnread, alreadyRead, otherUser] = rows;
    // Unread rows of the session user were flipped.
    expect(firstUnread?.readAt).not.toBeNull();
    expect(secondUnread?.readAt).not.toBeNull();
    // An already-read row keeps its original instant untouched.
    expect(alreadyRead).toBeDefined();
    expect(alreadyRead?.readAt).not.toBeNull();
    expect(readBefore.readAt).not.toBeNull();
    expect(toIsoTimestamp(alreadyRead?.readAt!)).toBe(
      toIsoTimestamp(readBefore.readAt!),
    );
    // The other user's row was not touched.
    expect(otherUser?.readAt).toBeNull();
  });

  it("fails with UnauthorizedError when signed out", async () => {
    const ctx = await makeServiceTestLayer(NotificationsServiceLive);
    closeCtx = ctx.close;
    const { runEffect, mockGetSession } = ctx;
    mockGetSession.mockResolvedValue(null);

    const error = await runEffect(
      Effect.flip(NotificationsService.markAllRead()),
    );

    expect(error._tag).toBe("UnauthorizedError");
    expect(error.message).toBe(
      "You must be logged in to update your notifications",
    );
  });
});
