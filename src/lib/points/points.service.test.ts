import type { Kysely } from "kysely";
import { describe, expect, it } from "vitest";

import {
  CommentsService,
  CommentsServiceLive,
} from "../comments/comments.service";
import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
import { PostVotesService, PostVotesServiceLive } from "../votes/votes.service";
import { POINTS_RULES, type PointAction } from "./points.config";
import { PointsService, PointsServiceLive } from "./points.service";

type TestContext = Awaited<ReturnType<typeof makeServiceTestLayer>>;

const insertUser = async (db: Kysely<DB>, id: string) => {
  await db
    .insertInto("user")
    .values({ email: `${id}@test.com`, id, name: id })
    .execute();
};

const insertPost = async (
  db: Kysely<DB>,
  args: { userId: string; id?: number },
) => {
  const row = await db
    .insertInto("posts")
    .values({
      content: "post content",
      ...(args.id === undefined ? {} : { id: args.id }),
      thumbnailKey: "thumb.jpg",
      title: "Post",
      userId: args.userId,
      videoKey: null,
      videoMetadata: "{}",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row;
};

const ledgerRows = async (db: Kysely<DB>, userId: string) =>
  db
    .selectFrom("points_ledger")
    .selectAll()
    .where("userId", "=", userId)
    .execute();

describe("PointsService.award", () => {
  it("awards points and records a ledger row", async () => {
    const { db, runEffect } = await makeServiceTestLayer(PointsServiceLive);
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
    expect(rows[0].action).toBe("post-upload");
    expect(rows[0].points).toBe(POINTS_RULES["post-upload"].points);
  });

  it("never awards the same (refId, actorId) twice", async () => {
    const { db, runEffect } = await makeServiceTestLayer(PointsServiceLive);
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
    const { db, runEffect } = await makeServiceTestLayer(PointsServiceLive);
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
    const { db, runEffect } = await makeServiceTestLayer(PointsServiceLive);
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

describe("PointsService.total", () => {
  it("sums every ledger row for the user", async () => {
    const { db, runEffect } = await makeServiceTestLayer(PointsServiceLive);
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

describe("service hooks", () => {
  it("CommentsService.add credits the commenter", async () => {
    const ctx: TestContext = await makeServiceTestLayer(CommentsServiceLive);
    const { db, runEffect, mockGetSession } = ctx;
    await insertUser(db, "commenter-1");
    const post = await insertPost(db, { userId: "commenter-1" });

    mockGetSession.mockResolvedValueOnce({
      user: { id: "commenter-1" },
    });
    await runEffect(
      CommentsService.add({ content: "nice sakuga", postId: post.id }),
    );

    const rows = await ledgerRows(db, "commenter-1");
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("comment-written");
    expect(rows[0].refId).not.toBeNull();
  });

  it("PostVotesService.set credits the post author when someone likes", async () => {
    const ctx: TestContext = await makeServiceTestLayer(PostVotesServiceLive);
    const { db, runEffect, mockGetSession } = ctx;
    await insertUser(db, "author-1");
    await insertUser(db, "voter-1");
    const post = await insertPost(db, { userId: "author-1" });

    // A self-like earns nothing.
    mockGetSession.mockResolvedValueOnce({ user: { id: "author-1" } });
    await runEffect(PostVotesService.set({ postId: post.id, vote: "like" }));
    expect(await ledgerRows(db, "author-1")).toHaveLength(0);

    // Another user's like pays out once.
    mockGetSession.mockResolvedValueOnce({ user: { id: "voter-1" } });
    await runEffect(PostVotesService.set({ postId: post.id, vote: "like" }));
    let rows = await ledgerRows(db, "author-1");
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("post-like-received");
    expect(rows[0].actorId).toBe("voter-1");

    // Dislike then re-like never pays twice.
    mockGetSession.mockResolvedValueOnce({ user: { id: "voter-1" } });
    await runEffect(PostVotesService.set({ postId: post.id, vote: "dislike" }));
    mockGetSession.mockResolvedValueOnce({ user: { id: "voter-1" } });
    await runEffect(PostVotesService.set({ postId: post.id, vote: "like" }));
    rows = await ledgerRows(db, "author-1");
    expect(rows).toHaveLength(1);
  });
});
