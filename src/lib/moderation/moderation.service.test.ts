import { Effect } from "effect";
import type { Kysely } from "kysely";
import { afterEach, describe, expect, it } from "vitest";

import { makeAuthSession } from "../auth/session.fixture";
import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
import { ModerationService, ModerationServiceLive } from "./moderation.service";

let closeCtx: (() => Promise<void>) | undefined;

afterEach(async () => {
  await closeCtx?.();
  closeCtx = undefined;
});

const insertUser = (db: Kysely<DB>, args: { id: string; role: string }) =>
  db
    .insertInto("user")
    .values({
      email: `${args.id}@test.com`,
      id: args.id,
      name: args.id,
      role: args.role,
      username: args.id.toLowerCase(),
    })
    .execute();

let postSeq = 0;

const insertPost = async (db: Kysely<DB>, ownerId: string) => {
  postSeq += 1;
  await db
    .insertInto("posts")
    .values({
      description: "original description",
      id: postSeq,
      thumbnailKey: `thumb-${postSeq}.jpg`,
      title: `Post ${postSeq}`,
      userId: ownerId,
      videoKey: null,
      videoMetadata: "{}",
    })
    .execute();
  return postSeq;
};

const insertReport = (
  db: Kysely<DB>,
  args: { createdAt: Date; postId: number; reporterId: string },
) =>
  db
    .insertInto("post_reports")
    .values({
      createdAt: args.createdAt,
      postId: args.postId,
      reason: "spam",
      userId: args.reporterId,
    })
    .execute();

const insertPendingEdit = async (
  db: Kysely<DB>,
  args: {
    approverIds?: ReadonlyArray<string>;
    createdAt: Date;
    postId: number;
    suggestedById: string;
  },
) => {
  const result = await db
    .insertInto("post_edits")
    .values({
      createdAt: args.createdAt,
      payload: '{"title":"Edited"}',
      postId: args.postId,
      status: "pending",
      suggestedBy: args.suggestedById,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  for (const approverId of args.approverIds ?? []) {
    await db
      .insertInto("post_edit_approvals")
      .values({ editId: result.id, userId: approverId })
      .execute();
  }
  return result.id;
};

describe("ModerationService.overview", () => {
  it("forbids non-staff users", async () => {
    const ctx = await makeServiceTestLayer(ModerationServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "novice-1", role: "novice" });

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "novice-1", role: "novice" }),
    );
    const error = await ctx.runEffect(
      Effect.flip(ModerationService.overview()),
    );

    expect(error._tag).toBe("ForbiddenError");
    expect(error.message).toBe(
      "Only moderators can view the moderation queues.",
    );
  });

  it("requires a signed-in user", async () => {
    const ctx = await makeServiceTestLayer(ModerationServiceLive);
    closeCtx = ctx.close;
    ctx.mockGetSession.mockResolvedValue(null);

    const error = await ctx.runEffect(
      Effect.flip(ModerationService.overview()),
    );

    expect(error._tag).toBe("UnauthorizedError");
  });

  it("returns reports newest-first with joined titles and reporter names", async () => {
    const ctx = await makeServiceTestLayer(ModerationServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "mod-1", role: "moderator" });
    await insertUser(db, { id: "owner-1", role: "novice" });
    await insertUser(db, { id: "reporter-a", role: "novice" });
    await insertUser(db, { id: "reporter-b", role: "novice" });
    const postId = await insertPost(db, "owner-1");

    const older = new Date("2026-01-01T10:00:00.000Z");
    const newer = new Date("2026-01-02T10:00:00.000Z");
    await insertReport(db, {
      createdAt: older,
      postId,
      reporterId: "reporter-a",
    });
    await insertReport(db, {
      createdAt: newer,
      postId,
      reporterId: "reporter-b",
    });

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "mod-1", role: "moderator" }),
    );
    const overview = await ctx.runEffect(ModerationService.overview());

    expect(overview.reports).toHaveLength(2);
    // Newest report first, joined with the post title and reporter name.
    expect(overview.reports[0]).toMatchObject({
      postId,
      postTitle: `Post ${postId}`,
      reason: "spam",
      reporterName: "reporter-b",
    });
    expect(overview.reports[1]).toMatchObject({ reporterName: "reporter-a" });
    const times = overview.reports.map((row) => Date.parse(row.createdAt));
    expect(times.every(Number.isFinite)).toBe(true);
    expect(times[0]).toBeGreaterThan(times[1]);
  });

  it("lists pending edits with live approval counts and excludes resolved ones", async () => {
    const ctx = await makeServiceTestLayer(ModerationServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "mod-1", role: "admin" });
    await insertUser(db, { id: "owner-1", role: "novice" });
    await insertUser(db, { id: "uploader-a", role: "uploader" });
    await insertUser(db, { id: "uploader-b", role: "uploader" });
    await insertUser(db, { id: "suggester-1", role: "uploader" });
    const postId = await insertPost(db, "owner-1");
    await db
      .insertInto("post_edits")
      .values({
        createdAt: new Date("2026-01-01T09:00:00.000Z"),
        payload: '{"title":"Resolved"}',
        postId,
        status: "approved",
        suggestedBy: "suggester-1",
      })
      .execute();

    await insertPendingEdit(db, {
      approverIds: ["uploader-a", "uploader-b"],
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      postId,
      suggestedById: "suggester-1",
    });
    await insertPendingEdit(db, {
      createdAt: new Date("2026-01-01T11:00:00.000Z"),
      postId,
      suggestedById: "suggester-1",
    });

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "mod-1", role: "admin" }),
    );
    const overview = await ctx.runEffect(ModerationService.overview());

    // Resolved suggestions never appear; pending ones are newest-first.
    expect(overview.pendingEdits).toHaveLength(2);
    const [newest, oldest] = overview.pendingEdits;
    expect(newest).toMatchObject({
      approvals: 0,
      editId: expect.any(Number),
      postId,
      postTitle: `Post ${postId}`,
      suggestedByName: "suggester-1",
    });
    expect(oldest?.approvals).toBe(2);
    expect(oldest?.editId).not.toBe(newest?.editId);
  });

  it("caps each queue at the moderation queue limit", async () => {
    const ctx = await makeServiceTestLayer(ModerationServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "mod-1", role: "moderator" });
    await insertUser(db, { id: "owner-1", role: "novice" });
    await insertUser(db, { id: "suggester-1", role: "novice" });
    const postId = await insertPost(db, "owner-1");

    // Reports queue: 51 rows, only the 50 newest survive.
    for (let i = 0; i < 51; i += 1) {
      const reporterId = `reporter-${i}`;
      await insertUser(db, { id: reporterId, role: "novice" });
      await insertReport(db, {
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
        postId,
        reporterId,
      });
    }

    // Pending-edit queue: 51 rows, only the 50 newest survive. A regression
    // dropping the `.limit(50)` on EITHER queue must fail here.
    const editIds: number[] = [];
    for (let i = 0; i < 51; i += 1) {
      editIds.push(
        await insertPendingEdit(db, {
          createdAt: new Date(Date.UTC(2026, 0, 1, 1, 0, i)),
          postId,
          suggestedById: "suggester-1",
        }),
      );
    }

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "mod-1", role: "moderator" }),
    );
    const overview = await ctx.runEffect(ModerationService.overview());

    // Only the 50 newest reports survive the cut, oldest dropped entirely.
    expect(overview.reports).toHaveLength(50);
    const reporters = overview.reports.map((row) => row.reporterName);
    expect(reporters[0]).toBe("reporter-50");
    expect(reporters.at(-1)).toBe("reporter-1");
    expect(reporters).not.toContain("reporter-0");
    const times = overview.reports.map((row) => Date.parse(row.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));

    // Same cut for the pending-edit queue.
    expect(overview.pendingEdits).toHaveLength(50);
    const editIdsReturned = overview.pendingEdits.map((row) => row.editId);
    expect(editIdsReturned[0]).toBe(editIds[50]);
    expect(editIdsReturned.at(-1)).toBe(editIds[1]);
    expect(editIdsReturned).not.toContain(editIds[0]);
    const editTimes = overview.pendingEdits.map((row) =>
      Date.parse(row.createdAt),
    );
    expect(editTimes).toEqual([...editTimes].sort((a, b) => b - a));
  });
});

describe("ModerationService.setUserRole", () => {
  it("is admin-only: moderators are forbidden", async () => {
    const ctx = await makeServiceTestLayer(ModerationServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "mod-1", role: "moderator" });
    await insertUser(db, { id: "target-1", role: "novice" });

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "mod-1", role: "moderator" }),
    );
    const error = await ctx.runEffect(
      Effect.flip(
        ModerationService.setUserRole({ role: "uploader", userId: "target-1" }),
      ),
    );

    expect(error._tag).toBe("ForbiddenError");
    expect(error.message).toBe("Only admins can assign roles.");
    const row = await db
      .selectFrom("user")
      .select("role")
      .where("id", "=", "target-1")
      .executeTakeFirstOrThrow();
    expect(row.role).toBe("novice");
  });

  it("rejects unknown role labels", async () => {
    const ctx = await makeServiceTestLayer(ModerationServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "admin-1", role: "admin" });

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "admin-1", role: "admin" }),
    );
    const error = await ctx.runEffect(
      Effect.flip(
        ModerationService.setUserRole({ role: "superuser", userId: "admin-1" }),
      ),
    );

    expect(error._tag).toBe("ForbiddenError");
    expect(error.message).toBe('Unknown role "superuser".');
  });

  it("is a no-op for unknown target users", async () => {
    const ctx = await makeServiceTestLayer(ModerationServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "admin-1", role: "admin" });

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "admin-1", role: "admin" }),
    );
    const result = await ctx.runEffect(
      ModerationService.setUserRole({
        role: "moderator",
        userId: "does-not-exist",
      }),
    );

    expect(result).toEqual({ userId: "does-not-exist" });
  });

  it("succeeds idempotently when the target already holds the role", async () => {
    const ctx = await makeServiceTestLayer(ModerationServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "admin-1", role: "admin" });
    await insertUser(db, { id: "mod-1", role: "moderator" });

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "admin-1", role: "admin" }),
    );
    const result = await ctx.runEffect(
      ModerationService.setUserRole({ role: "moderator", userId: "mod-1" }),
    );

    expect(result).toEqual({ userId: "mod-1" });
    const row = await db
      .selectFrom("user")
      .select("role")
      .where("id", "=", "mod-1")
      .executeTakeFirstOrThrow();
    expect(row.role).toBe("moderator");
  });

  it("persists the role change for a valid target", async () => {
    const ctx = await makeServiceTestLayer(ModerationServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "admin-1", role: "admin" });
    await insertUser(db, { id: "target-1", role: "novice" });

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "admin-1", role: "admin" }),
    );
    const result = await ctx.runEffect(
      ModerationService.setUserRole({ role: "moderator", userId: "target-1" }),
    );

    expect(result).toEqual({ userId: "target-1" });
    const row = await db
      .selectFrom("user")
      .select("role")
      .where("id", "=", "target-1")
      .executeTakeFirstOrThrow();
    expect(row.role).toBe("moderator");
  });
});
