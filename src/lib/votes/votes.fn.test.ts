import type { Kysely } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
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

let postId: number;

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

  postId = post.id;
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
      runEffect(PostVotesService.set({ postId: 999, vote: "like" })),
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
