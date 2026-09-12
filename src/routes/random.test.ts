import { isNotFound, isRedirect } from "@tanstack/react-router";
import { asPostId } from "src/lib/ids";
import { searchPosts } from "src/lib/posts/posts.service";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadRandomVideo } from "./random";

vi.mock("src/lib/posts/posts.service", () => ({
  searchPosts: vi.fn(),
}));

const makeSearchResult = (postIds: readonly number[]) =>
  ({
    data: postIds.map((postId) => ({
      animeTitle: null,
      chapterNumber: null,
      createdAt: "2026-09-12T00:00:00.000Z",
      description: "A video description",
      dislikes: 0,
      episodeNumber: null,
      id: asPostId(postId),
      likes: 0,
      relatedPostId: null,
      seasonNumber: null,
      source: null,
      sourceType: null,
      thumbnailKey: `thumbnails/${postId}.jpg`,
      title: `Video ${postId}`,
      userId: "user-1",
      videoKey: `videos/${postId}.mp4`,
      videoMetadata: {},
      volumeNumber: null,
    })),
    meta: {
      pagination: {
        currentPage: 1,
        hasMore: false,
        hasPrevious: false,
        limit: 30,
        offset: 0,
        total: postIds.length,
        totalPages: postIds.length === 0 ? 0 : 1,
      },
      popularTags: [],
    },
  }) satisfies Awaited<ReturnType<typeof searchPosts>>;

describe("random video route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to a random video detail page", async () => {
    vi.mocked(searchPosts).mockResolvedValue(makeSearchResult([42]));

    const rejection = await loadRandomVideo().then(
      () => null,
      (error: unknown) => error,
    );

    expect(searchPosts).toHaveBeenCalledWith({
      data: {
        dateRange: "all",
        page: 0,
        q: "",
        randomSeed: expect.any(Number),
        sortBy: "newest",
        tags: ["video"],
        view: "random-study",
      },
    });
    expect(isRedirect(rejection)).toBe(true);

    if (!isRedirect(rejection)) return;

    expect(rejection.options.to).toBe("/posts/$postId");
    expect(rejection.options.params).toEqual({ postId: "42" });
  });

  it("returns not found when no video is available", async () => {
    vi.mocked(searchPosts).mockResolvedValue(makeSearchResult([]));

    const rejection = await loadRandomVideo().then(
      () => null,
      (error: unknown) => error,
    );

    expect(isNotFound(rejection)).toBe(true);
  });
});
