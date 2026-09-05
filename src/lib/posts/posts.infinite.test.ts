import { describe, expect, it } from "vitest";

import { asPostId } from "../ids";
import type { PostsInfinitePage } from "./posts.queries";
import {
  computeAnchorPostIndex,
  postsNextPageParam,
  postsPreviousPageParam,
} from "./posts.queries";

const makePage = (
  opts: { hasMore?: boolean; hasPrevious?: boolean; length?: number } = {},
): PostsInfinitePage => ({
  data: Array.from({ length: opts.length ?? 2 }, (_, i) => ({
    animeTitle: null,
    chapterNumber: null,
    description: "description",
    createdAt: new Date(),
    dislikes: 0,
    episodeNumber: null,
    id: asPostId(i),
    likes: 0,
    relatedPostId: null,
    seasonNumber: null,
    source: null,
    sourceType: null,
    thumbnailKey: "thumb",
    title: `post-${i}`,
    userId: "user-1",
    videoKey: "video",
    videoMetadata: {},
    volumeNumber: null,
  })),
  meta: {
    pagination: {
      currentPage: 1,
      hasMore: opts.hasMore ?? false,
      hasPrevious: opts.hasPrevious ?? false,
      limit: 30,
      offset: 0,
      total: 2,
      totalPages: 1,
    },
  },
});

describe("postsNextPageParam", () => {
  it("returns the next page when more results exist", () => {
    expect(postsNextPageParam(makePage({ hasMore: true }), [], 3)).toBe(4);
  });

  it("returns undefined at the last page", () => {
    expect(
      postsNextPageParam(makePage({ hasMore: false }), [], 9),
    ).toBeUndefined();
  });
});

describe("postsPreviousPageParam", () => {
  it("returns the previous page when one exists", () => {
    expect(postsPreviousPageParam(makePage({ hasPrevious: true }), [], 5)).toBe(
      4,
    );
  });

  it("returns undefined on the first page", () => {
    expect(
      postsPreviousPageParam(makePage({ hasPrevious: false }), [], 0),
    ).toBeUndefined();
  });
});

describe("computeAnchorPostIndex", () => {
  it("returns null when the anchor page is not loaded", () => {
    expect(computeAnchorPostIndex([0, 1, 2], 5, [30, 30, 30])).toBeNull();
  });

  it("returns 0 for the first loaded page", () => {
    expect(computeAnchorPostIndex([9, 10, 11], 9, [30, 30, 30])).toBe(0);
  });

  it("sums the item counts of pages before the anchor", () => {
    expect(computeAnchorPostIndex([9, 10, 11], 10, [30, 30, 30])).toBe(30);
    expect(computeAnchorPostIndex([9, 10, 11], 11, [30, 30, 30])).toBe(60);
  });

  it("handles a partial page before the anchor", () => {
    expect(computeAnchorPostIndex([9, 10, 11], 10, [12, 30, 30])).toBe(12);
  });
});
