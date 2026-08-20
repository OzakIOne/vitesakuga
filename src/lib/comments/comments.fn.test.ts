import type { Kysely } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
import { CommentsService, CommentsServiceLive } from "./comments.service";

let db: Kysely<DB>;
let runEffect: ReturnType<typeof makeServiceTestLayer>["runEffect"];
let mockGetSession: ReturnType<typeof vi.fn>;

const testUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@test.com",
  image: null,
};

let postId: number;

beforeEach(async () => {
  const ctx = await makeServiceTestLayer(CommentsServiceLive);
  db = ctx.db;
  runEffect = ctx.runEffect;
  mockGetSession = ctx.mockGetSession;

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

describe("CommentsService.fetch", () => {
  it("returns empty array when no comments", async () => {
    const result = await runEffect(CommentsService.fetch(postId));
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

    const result = await runEffect(CommentsService.fetch(postId));

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

    const result = await runEffect(CommentsService.fetch(postId));

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("Second");
    expect(result[1].content).toBe("First");
  });
});

describe("CommentsService.add", () => {
  it("throws unauthorized when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(
      runEffect(
        CommentsService.add({
          content: "Nice!",
          postId,
        }),
      ),
    ).rejects.toThrow("You must be logged in");
  });

  it("creates a comment as the session user and returns it", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    const result = await runEffect(
      CommentsService.add({
        content: "Nice!",
        postId,
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
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    await expect(
      runEffect(
        CommentsService.add({
          content: "Bad",
          postId: 999,
        }),
      ),
    ).rejects.toThrow("SqlError");
  });
});

describe("CommentsService.delete_", () => {
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

    await expect(runEffect(CommentsService.delete_(commentId))).rejects.toThrow(
      "You must be logged in",
    );
  });

  it("throws forbidden when user does not own the comment", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-2" } });

    await expect(runEffect(CommentsService.delete_(commentId))).rejects.toThrow(
      "can only delete your own",
    );
  });

  it("throws not found when comment does not exist", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    await expect(runEffect(CommentsService.delete_(9999))).rejects.toThrow(
      "Comment 9999 not found",
    );
  });

  it("deletes own comment successfully", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    const result = await runEffect(CommentsService.delete_(commentId));

    expect(result).toEqual({ success: true });

    const comments = await db
      .selectFrom("comments")
      .selectAll()
      .where("id", "=", commentId)
      .execute();

    expect(comments).toHaveLength(0);
  });
});
