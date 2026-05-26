import { Effect, Layer } from "effect";
import type { Kysely } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSessionProvider } from "../auth/context";
import type { DB } from "../db/kysely";
import { createTestKysely, makeTestLayer } from "../db/test-utils";
import { CommentsServiceLive } from "./comments.service";
import {
  addCommentEffect,
  deleteCommentEffect,
  fetchCommentsEffect,
} from "./comments.fn";

let db: Kysely<DB>;
let testLayer: Layer.Layer<any, any>;
let mockGetSession: ReturnType<typeof vi.fn>;

const testUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@test.com",
  image: null,
};

let postId: number;

beforeEach(async () => {
  mockGetSession = vi.fn();
  const result = await createTestKysely();
  db = result.db;
  const baseLayer = makeTestLayer(
    db,
    { api: { getSession: mockGetSession } } as AuthSessionProvider,
    () => new Headers(),
  );
  testLayer = CommentsServiceLive.pipe(Layer.provideMerge(baseLayer));

  await db.insertInto("user").values(testUser).execute();

  const post = await db
    .insertInto("posts")
    .values({
      title: "Test Post",
      content: "Content",
      userId: "user-1",
      videoKey: "videos/abc.mp4",
      thumbnailKey: "thumbnails/abc.jpg",
      videoMetadata: "{}",
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  postId = post.id;
});

const runEffect = <T>(effect: Effect.Effect<T>) =>
  Effect.runPromise(effect.pipe(Effect.provide(testLayer)));

describe(fetchCommentsEffect, () => {
  it("returns empty array when no comments", async () => {
    const result = await runEffect(fetchCommentsEffect(postId));
    expect(result).toEqual([]);
  });

  it("returns comments with user info", async () => {
    await db
      .insertInto("comments")
      .values({
        content: "Great post!",
        postId,
        userId: "user-1",
      })
      .execute();

    const result = await runEffect(fetchCommentsEffect(postId));

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Great post!");
    expect(result[0].userName).toBe("Alice");
    expect(result[0].userImage).toBeNull();
    expect(result[0].postId).toBe(postId);
    expect(result[0].userId).toBe("user-1");
  });

  it("returns comments ordered by newest first", async () => {
    await db
      .insertInto("comments")
      .values({
        content: "First",
        postId,
        userId: "user-1",
        createdAt: new Date("2024-01-01"),
      })
      .execute();
    await db
      .insertInto("comments")
      .values({
        content: "Second",
        postId,
        userId: "user-1",
        createdAt: new Date("2024-01-02"),
      })
      .execute();

    const result = await runEffect(fetchCommentsEffect(postId));

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("Second");
    expect(result[1].content).toBe("First");
  });
});

describe(addCommentEffect, () => {
  it("creates a comment and returns it", async () => {
    const result = await runEffect(
      addCommentEffect({
        content: "Nice!",
        postId,
        userId: "user-1",
      }),
    );

    expect(result.content).toBe("Nice!");
    expect(result.postId).toBe(postId);
    expect(result.userId).toBe("user-1");

    const comments = await db
      .selectFrom("comments")
      .selectAll()
      .where("postId", "=", postId)
      .execute();

    expect(comments).toHaveLength(1);
    expect(comments[0].content).toBe("Nice!");
  });

  it("throws on database error for missing post", async () => {
    await expect(
      runEffect(
        addCommentEffect({
          content: "Bad",
          postId: 999,
          userId: "user-1",
        }),
      ),
    ).rejects.toThrow("Failed to add comment");
  });
});

describe(deleteCommentEffect, () => {
  let commentId: number;

  beforeEach(async () => {
    const result = await db
      .insertInto("comments")
      .values({
        content: "Delete me",
        postId,
        userId: "user-1",
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    commentId = result.id;
  });

  it("throws unauthorized when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(runEffect(deleteCommentEffect({ commentId }))).rejects.toThrow(
      "You must be logged in",
    );
  });

  it("throws forbidden when user does not own the comment", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-2" } });

    await expect(runEffect(deleteCommentEffect({ commentId }))).rejects.toThrow(
      "can only delete your own",
    );
  });

  it("throws not found when comment does not exist", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    await expect(
      runEffect(deleteCommentEffect({ commentId: 9999 })),
    ).rejects.toThrow("Comment 9999 not found");
  });

  it("deletes own comment successfully", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    const result = await runEffect(deleteCommentEffect({ commentId }));

    expect(result).toEqual({ success: true });

    const comments = await db
      .selectFrom("comments")
      .selectAll()
      .where("id", "=", commentId)
      .execute();

    expect(comments).toHaveLength(0);
  });
});
