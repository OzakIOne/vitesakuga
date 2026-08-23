import type { Kysely } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
import type { PostId } from "../ids";
import { asPostId } from "../ids";
import { PostVotesService, PostVotesServiceLive } from "./votes.service";

let db: Kysely<DB>;
let runEffect: ReturnType<typeof makeServiceTestLayer>["runEffect"];
let mockGetSession: ReturnType<typeof vi.fn>;

const testUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@test.com",
  image: null,
};

let postId: PostId;

beforeEach(async () => {
  const ctx = await makeServiceTestLayer(PostVotesServiceLive);
  db = ctx.db;
  runEffect = ctx.runEffect;
  mockGetSession = ctx.mockGetSession;
  mockGetSession.mockResolvedValue(null);

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

  postId = asPostId(post.id);
});

describe("PostVotesService.get", () => {
  it("returns zero counts and no user vote when there are no votes", async () => {
    const result = await runEffect(PostVotesService.get(postId));

    expect(result).toEqual({ dislikes: 0, likes: 0, userVote: null });
  });

  it("returns counts without the user's vote when logged out", async () => {
    await db
      .insertInto("post_votes")
      .values({ postId, userId: "user-1", vote: "like" })
      .execute();

    mockGetSession.mockResolvedValueOnce(null);
    const result = await runEffect(PostVotesService.get(postId));

    expect(result).toEqual({ dislikes: 0, likes: 1, userVote: null });
  });

  it("returns the current user's vote when logged in", async () => {
    await db
      .insertInto("post_votes")
      .values({ postId, userId: "user-1", vote: "dislike" })
      .execute();

    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    const result = await runEffect(PostVotesService.get(postId));

    expect(result).toEqual({ dislikes: 1, likes: 0, userVote: "dislike" });
  });
});

describe("PostVotesService.set", () => {
  it("throws unauthorized when logged out", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(
      runEffect(PostVotesService.set({ postId, vote: "like" })),
    ).rejects.toThrow("You must be logged in to vote on posts");
  });

  it("throws post not found for an unknown post", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    await expect(
      runEffect(PostVotesService.set({ postId: asPostId(999), vote: "like" })),
    ).rejects.toThrow("Post 999 not found");
  });

  it("adds a like and returns updated counts", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    const result = await runEffect(
      PostVotesService.set({ postId, vote: "like" }),
    );

    expect(result).toEqual({ dislikes: 0, likes: 1, userVote: "like" });
  });

  it("switches an existing vote instead of stacking it", async () => {
    await db
      .insertInto("post_votes")
      .values({ postId, userId: "user-1", vote: "like" })
      .execute();
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    const result = await runEffect(
      PostVotesService.set({ postId, vote: "dislike" }),
    );

    expect(result).toEqual({ dislikes: 1, likes: 0, userVote: "dislike" });
  });

  it("keeps other users' votes intact", async () => {
    await db
      .insertInto("user")
      .values({
        id: "user-2",
        name: "Bob",
        email: "bob@test.com",
        image: null,
      })
      .execute();
    await db
      .insertInto("post_votes")
      .values({ postId, userId: "user-2", vote: "like" })
      .execute();
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    const result = await runEffect(
      PostVotesService.set({ postId, vote: "dislike" }),
    );

    expect(result).toEqual({ dislikes: 1, likes: 1, userVote: "dislike" });
  });
});

describe("PostVotesService.remove", () => {
  it("throws unauthorized when logged out", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(
      runEffect(PostVotesService.remove({ postId })),
    ).rejects.toThrow("You must be logged in to vote on posts");
  });

  it("removes the user's vote and updates counts", async () => {
    await db
      .insertInto("post_votes")
      .values({ postId, userId: "user-1", vote: "like" })
      .execute();
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    const result = await runEffect(PostVotesService.remove({ postId }));

    expect(result).toEqual({ dislikes: 0, likes: 0, userVote: null });
  });

  it("is a no-op when the user has no vote", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    const result = await runEffect(PostVotesService.remove({ postId }));

    expect(result).toEqual({ dislikes: 0, likes: 0, userVote: null });
  });
});

describe("PostVotesService.fetchLikedPosts", () => {
  it("throws unauthorized when logged out", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(
      runEffect(PostVotesService.fetchLikedPosts({ page: 0 })),
    ).rejects.toThrow("You must be logged in to view your liked posts");
  });

  it("returns an empty virtual playlist when the user has no likes", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    const result = await runEffect(
      PostVotesService.fetchLikedPosts({ page: 0 }),
    );

    expect(result.playlist).toEqual({
      title: "Liked posts",
      description: null,
      is_public: false,
      post_count: 0,
      thumbnail_key: null,
    });
    expect(result.data).toEqual([]);
  });

  it("returns only the current user's likes, excluding dislikes and others' votes", async () => {
    await db
      .insertInto("user")
      .values({
        id: "user-2",
        name: "Bob",
        email: "bob@test.com",
        image: null,
      })
      .execute();
    const dislikedPost = await db
      .insertInto("posts")
      .values({
        title: "Disliked Post",
        content: "Content",
        userId: "user-1",
        videoKey: "videos/disliked.mp4",
        thumbnailKey: "thumbnails/disliked.jpg",
        videoMetadata: "{}",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("post_votes")
      .values([
        { postId, userId: "user-1", vote: "like" },
        { postId, userId: "user-2", vote: "like" },
        { postId: dislikedPost.id, userId: "user-1", vote: "dislike" },
      ])
      .execute();

    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    const result = await runEffect(
      PostVotesService.fetchLikedPosts({ page: 0 }),
    );

    expect(result.playlist.post_count).toBe(1);
    expect(result.playlist.thumbnail_key).toBe("thumbnails/abc.jpg");
    expect(result.data).toHaveLength(1);
    const row = result.data[0];
    expect(row?.post_id).toBe(postId);
    expect(row?.title).toBe("Test Post");
    expect(row?.thumbnail_key).toBe("thumbnails/abc.jpg");
    expect(row?.position).toBe(0);
  });

  it("orders by most recent like first with pagination metadata", async () => {
    const olderPost = await db
      .insertInto("posts")
      .values({
        title: "Older Post",
        content: "Content",
        userId: "user-1",
        videoKey: "videos/older.mp4",
        thumbnailKey: "thumbnails/older.jpg",
        videoMetadata: "{}",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("post_votes")
      .values([
        {
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
          postId: olderPost.id,
          userId: "user-1",
          vote: "like",
        },
        {
          createdAt: new Date("2024-01-02T00:00:00.000Z"),
          postId,
          userId: "user-1",
          vote: "like",
        },
      ])
      .execute();

    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    const result = await runEffect(
      PostVotesService.fetchLikedPosts({ page: 0 }),
    );

    expect(result.data.map((row) => row.post_id)).toEqual([
      postId,
      olderPost.id,
    ]);
    expect(result.data.map((row) => row.position)).toEqual([0, 1]);
    expect(result.meta.pagination).toMatchObject({
      total: 2,
      totalPages: 1,
      hasMore: false,
    });
  });
});
