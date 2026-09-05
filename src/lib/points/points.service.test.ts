import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { sql, type Kysely } from "kysely";
import { afterEach, describe, expect, it } from "vitest";

import { makeAuthSession } from "../auth/session.fixture";
import {
  CommentsService,
  CommentsServiceLive,
} from "../comments/comments.service";
import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
import { asPostId } from "../ids";
import { PostVotesService, PostVotesServiceLive } from "../votes/votes.service";
import { nextLocalMidnight } from "./local-day";
import { POINTS_RULES, type PointAction } from "./points.config";
import { PointsService, PointsServiceLive } from "./points.service";

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

const insertPost = async (
  db: Kysely<DB>,
  args: { userId: string; id?: number },
) => {
  const row = await db
    .insertInto("posts")
    .values({
      description: "post content",
      ...(args.id === undefined ? {} : { id: args.id }),
      thumbnailKey: "thumb.jpg",
      title: "Post",
      userId: args.userId,
      videoKey: null,
      videoMetadata: "{}",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  // Services take the branded PostId; brand it here so callers stay typed.
  return { ...row, id: asPostId(row.id) };
};

const ledgerRows = async (db: Kysely<DB>, userId: string) =>
  db
    .selectFrom("points_ledger")
    .selectAll()
    .where("userId", "=", userId)
    .execute();

describe("PointsService.award", () => {
  it("awards points and records a ledger row", async () => {
    const ctx = await makeServiceTestLayer(PointsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await insertUser(db, "user-1");

    const outcome = await runEffect(
      PointsService.award({ userId: "user-1", action: "post-upload" }),
    );

    expect(outcome).toEqual({
      kind: "awarded",
      points: POINTS_RULES["post-upload"].points,
    });
    const rows = await ledgerRows(db, "user-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.action).toBe("post-upload");
    expect(rows[0]!.points).toBe(POINTS_RULES["post-upload"].points);
  });

  it("never awards the same (refId, actorId) twice", async () => {
    const ctx = await makeServiceTestLayer(PointsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await insertUser(db, "author-1");

    const input = {
      userId: "author-1",
      action: "post-like-received",
      refId: 42,
      actorId: "voter-1",
    } as const;
    await runEffect(PointsService.award(input));
    // The voter toggles to dislike and back — or removes and re-likes.
    const second = await runEffect(PointsService.award(input));

    expect(second).toEqual({ kind: "already-earned" });
    expect(await ledgerRows(db, "author-1")).toHaveLength(1);
  });

  it("lets different voters each award the same post once", async () => {
    const ctx = await makeServiceTestLayer(PointsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await insertUser(db, "author-1");

    for (const actor of ["voter-1", "voter-2"]) {
      await runEffect(
        PointsService.award({
          userId: "author-1",
          action: "post-like-received",
          refId: 42,
          actorId: actor,
        }),
      );
    }

    expect(await ledgerRows(db, "author-1")).toHaveLength(2);
  });

  it("stops paying out past the daily cap", async () => {
    const ctx = await makeServiceTestLayer(PointsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await insertUser(db, "user-1");
    const action: PointAction = "comment-written";
    const rule = POINTS_RULES[action];

    let lastKind = "";
    for (let i = 0; i < rule.dailyCap + 2; i++) {
      const outcome = await runEffect(
        PointsService.award({
          userId: "user-1",
          action,
          refId: i,
          actorId: "user-1",
        }),
      );
      lastKind = outcome.kind;
    }

    expect(lastKind).toBe("daily-cap-reached");
    const rows = await ledgerRows(db, "user-1");
    expect(rows).toHaveLength(rule.dailyCap);
    const earned = rows.reduce((sum, row) => sum + row.points, 0);
    expect(earned).toBe(rule.dailyCap * rule.points);
  });
});

describe("PointsService.award (daily-cap window)", () => {
  // TestClock rides alongside the service so `Clock.currentTimeMillis` (the
  // daily-cap window source AND the ledger rows' `createdAt`) is fully
  // controlled by the test — no real wall-clock time participates.
  const makeCtx = () =>
    makeServiceTestLayer(Layer.merge(PointsServiceLive, TestClock.layer()));

  // A fixed instant: the cap window, the seeded rows and the midnight
  // boundary all derive from it, so the tests cannot drift with the machine
  // clock or straddle a real midnight mid-run.
  const FIXED_NOW = Date.parse("2026-06-15T10:30:00.000Z");
  const FIXED_NEXT_MIDNIGHT = nextLocalMidnight(FIXED_NOW);

  const award = (refId: number) =>
    PointsService.award({
      userId: "user-1",
      action: "post-upload",
      refId,
      actorId: "user-1",
    });

  it("resets the daily cap once the clock passes local midnight", async () => {
    const ctx = await makeCtx();
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await insertUser(db, "user-1");
    const cap = POINTS_RULES["post-upload"].dailyCap;

    const { beforeCap, capped, afterMidnight } = await runEffect(
      Effect.gen(function* () {
        yield* TestClock.setTime(FIXED_NOW);
        const beforeCap = [];
        for (let refId = 1; refId <= cap; refId++) {
          beforeCap.push(yield* award(refId));
        }
        const capped = yield* award(cap + 1);
        yield* TestClock.setTime(FIXED_NEXT_MIDNIGHT + 1);
        const afterMidnight = yield* award(cap + 2);
        return { beforeCap, capped, afterMidnight };
      }),
    );

    for (const outcome of beforeCap) {
      expect(outcome.kind).toBe("awarded");
    }
    expect(capped).toEqual({ kind: "daily-cap-reached" });
    expect(afterMidnight).toEqual({
      kind: "awarded",
      points: POINTS_RULES["post-upload"].points,
    });
  });

  it("splits the cap at midnight: the last earning counts for the old day, the first for the new", async () => {
    const ctx = await makeCtx();
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await insertUser(db, "user-1");
    const cap = POINTS_RULES["post-upload"].dailyCap;

    const { lastOfOldDay, cappedBeforeMidnight, firstOfNewDay } =
      await runEffect(
        Effect.gen(function* () {
          yield* TestClock.setTime(FIXED_NOW);
          const beforeCap = [];
          for (let refId = 1; refId <= cap - 1; refId++) {
            beforeCap.push(yield* award(refId));
          }
          // One millisecond before midnight: still the old day, so the cap
          // fills up across the earnings made earlier "today".
          yield* TestClock.setTime(FIXED_NEXT_MIDNIGHT - 1);
          const lastOfOldDay = yield* award(cap);
          const cappedBeforeMidnight = yield* award(cap + 1);
          // Crossing midnight starts a fresh cap.
          yield* TestClock.setTime(FIXED_NEXT_MIDNIGHT + 1);
          const firstOfNewDay = yield* award(cap + 2);
          return { lastOfOldDay, cappedBeforeMidnight, firstOfNewDay };
        }),
      );

    expect(lastOfOldDay.kind).toBe("awarded");
    expect(cappedBeforeMidnight).toEqual({ kind: "daily-cap-reached" });
    expect(firstOfNewDay).toEqual({
      kind: "awarded",
      points: POINTS_RULES["post-upload"].points,
    });
  });
});

describe("PointsService.total", () => {
  it("sums every ledger row for the user", async () => {
    const ctx = await makeServiceTestLayer(PointsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await insertUser(db, "user-1");
    await runEffect(
      PointsService.award({ userId: "user-1", action: "post-upload" }),
    );
    await runEffect(
      PointsService.award({ userId: "user-1", action: "comment-written" }),
    );

    const expected =
      POINTS_RULES["post-upload"].points +
      POINTS_RULES["comment-written"].points;

    expect(await runEffect(PointsService.total("user-1"))).toBe(expected);
    expect(await runEffect(PointsService.total("nobody"))).toBe(0);
  });
});

describe("PointsService.awardOrLog", () => {
  /**
   * Breaks ledger writes while keeping the dedupe/daily-cap reads intact:
   * both reads select `id`/`count` only, so removing the `points` column
   * deterministically fails just the insert.
   */
  const dropLedgerPoints = (db: Kysely<DB>) =>
    sql`ALTER TABLE points_ledger DROP COLUMN points`.execute(db);

  it("swallows a SqlError and resolves undefined without writing a ledger row", async () => {
    const ctx = await makeServiceTestLayer(PointsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await insertUser(db, "user-1");
    await dropLedgerPoints(db);
    // Restore in finally: the file shares one PGlite, so a broken schema
    // would poison every later test, not just the next fresh instance.
    try {
      await expect(
        runEffect(
          PointsService.awardOrLog({ userId: "user-1", action: "post-upload" }),
        ),
      ).resolves.toBeUndefined();

      // awardOrLog must have written nothing.
      expect(await ledgerRows(db, "user-1")).toHaveLength(0);
    } finally {
      await sql`ALTER TABLE points_ledger ADD COLUMN points integer NOT NULL DEFAULT 0`.execute(
        db,
      );
    }
  });

  it("award rejects with SqlError in the same broken-ledger setup", async () => {
    const ctx = await makeServiceTestLayer(PointsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await insertUser(db, "user-1");
    await dropLedgerPoints(db);
    try {
      const error = await runEffect(
        Effect.flip(
          PointsService.award({ userId: "user-1", action: "post-upload" }),
        ),
      );
      expect(error._tag).toBe("SqlError");
    } finally {
      await sql`ALTER TABLE points_ledger ADD COLUMN points integer NOT NULL DEFAULT 0`.execute(
        db,
      );
    }
  });
});

describe("service hooks", () => {
  it("CommentsService.add credits the commenter", async () => {
    const ctx = await makeServiceTestLayer(CommentsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect, mockGetSession } = ctx;
    await insertUser(db, "commenter-1");
    const post = await insertPost(db, { userId: "commenter-1" });

    mockGetSession.mockResolvedValueOnce(
      makeAuthSession({ id: "commenter-1" }),
    );
    await runEffect(
      CommentsService.add({ content: "nice sakuga", postId: post.id }),
    );

    const rows = await ledgerRows(db, "commenter-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.action).toBe("comment-written");
    expect(rows[0]!.refId).not.toBeNull();
  });

  it("PostVotesService.set credits the post author when someone likes", async () => {
    const ctx = await makeServiceTestLayer(PostVotesServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect, mockGetSession } = ctx;
    await insertUser(db, "author-1");
    await insertUser(db, "voter-1");
    const post = await insertPost(db, { userId: "author-1" });

    // A self-like earns nothing.
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "author-1" }));
    await runEffect(PostVotesService.set({ postId: post.id, vote: "like" }));
    expect(await ledgerRows(db, "author-1")).toHaveLength(0);

    // Another user's like pays out once.
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "voter-1" }));
    await runEffect(PostVotesService.set({ postId: post.id, vote: "like" }));
    let rows = await ledgerRows(db, "author-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.action).toBe("post-like-received");
    expect(rows[0]!.actorId).toBe("voter-1");

    // Dislike then re-like never pays twice.
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "voter-1" }));
    await runEffect(PostVotesService.set({ postId: post.id, vote: "dislike" }));
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "voter-1" }));
    await runEffect(PostVotesService.set({ postId: post.id, vote: "like" }));
    rows = await ledgerRows(db, "author-1");
    expect(rows).toHaveLength(1);
  });
});
