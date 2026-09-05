import { Effect } from "effect";
import type { Kysely } from "kysely";
import { afterEach, describe, expect, it } from "vitest";

import { makeAuthSession } from "../auth/session.fixture";
import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
import { asPostId } from "../ids";
import { PostReportsService, PostReportsServiceLive } from "./reports.service";

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
  // The services take the branded PostId; the brand is erased on the wire
  // and re-checked here so service calls stay type-checked.
  return { ...row, id: asPostId(row.id) };
};

const reportRows = async (db: Kysely<DB>) =>
  db.selectFrom("post_reports").selectAll().orderBy("userId", "asc").execute();

describe("PostReportsService.submit", () => {
  it("fails with UnauthorizedError when signed out", async () => {
    const ctx = await makeServiceTestLayer(PostReportsServiceLive);
    closeCtx = ctx.close;
    const { runEffect, mockGetSession } = ctx;
    mockGetSession.mockResolvedValue(null);

    const error = await runEffect(
      Effect.flip(
        PostReportsService.submit({ postId: asPostId(1), reason: "duplicate" }),
      ),
    );

    expect(error._tag).toBe("UnauthorizedError");
    expect(error.message).toBe("You must be logged in to report posts");
  });

  it("fails with PostNotFoundError when the post does not exist", async () => {
    const ctx = await makeServiceTestLayer(PostReportsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect, mockGetSession } = ctx;
    await insertUser(db, "user-1");
    mockGetSession.mockResolvedValue(makeAuthSession({ id: "user-1" }));

    const error = await runEffect(
      Effect.flip(
        PostReportsService.submit({
          postId: asPostId(999_999),
          reason: "duplicate",
        }),
      ),
    );

    expect(error._tag).toBe("PostNotFoundError");
    if (error._tag !== "PostNotFoundError") {
      throw new Error("unreachable: _tag asserted above");
    }
    expect(error.postId).toBe(999_999);
    expect(await reportRows(db)).toHaveLength(0);
  });

  it("inserts a report row with the given reason", async () => {
    const ctx = await makeServiceTestLayer(PostReportsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect, mockGetSession } = ctx;
    await insertUser(db, "user-1");
    const post = await insertPost(db, { userId: "user-1" });
    mockGetSession.mockResolvedValue(makeAuthSession({ id: "user-1" }));

    const result = await runEffect(
      PostReportsService.submit({ postId: post.id, reason: "duplicate" }),
    );

    expect(result).toEqual({ postId: post.id, reported: true });
    const rows = await reportRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      postId: post.id,
      reason: "duplicate",
      userId: "user-1",
    });
  });

  it("re-reporting updates the reason instead of duplicating the row", async () => {
    const ctx = await makeServiceTestLayer(PostReportsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect, mockGetSession } = ctx;
    await insertUser(db, "user-1");
    const post = await insertPost(db, { userId: "user-1" });
    mockGetSession.mockResolvedValue(makeAuthSession({ id: "user-1" }));

    await runEffect(
      PostReportsService.submit({ postId: post.id, reason: "duplicate" }),
    );
    await runEffect(
      PostReportsService.submit({ postId: post.id, reason: "unrelated" }),
    );

    const rows = await reportRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      postId: post.id,
      reason: "unrelated",
      userId: "user-1",
    });
  });

  it("lets a different user report the same post in its own row", async () => {
    const ctx = await makeServiceTestLayer(PostReportsServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect, mockGetSession } = ctx;
    await insertUser(db, "user-1");
    await insertUser(db, "user-2");
    const post = await insertPost(db, { userId: "user-1" });
    mockGetSession.mockResolvedValue(makeAuthSession({ id: "user-1" }));
    await runEffect(
      PostReportsService.submit({ postId: post.id, reason: "duplicate" }),
    );
    mockGetSession.mockResolvedValue(makeAuthSession({ id: "user-2" }));
    await runEffect(
      PostReportsService.submit({ postId: post.id, reason: "poor_quality" }),
    );

    const rows = await reportRows(db);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      postId: post.id,
      reason: "duplicate",
      userId: "user-1",
    });
    expect(rows[1]).toMatchObject({
      postId: post.id,
      reason: "poor_quality",
      userId: "user-2",
    });
  });
});
