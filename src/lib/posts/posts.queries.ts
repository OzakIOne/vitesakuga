import type { PostWithVotes } from "../db/schema";
import type { PaginationMeta } from "../pagination/pagination";
import type { PostsSearchParams } from "./posts.schema";

export const postsKeys = {
  all: ["posts"] as const,
  detail: (postId: number) => [...postsKeys.all, "detail", postId] as const,
  search: (params: PostsSearchParams) =>
    [...postsKeys.all, "search", params] as const,
  series: (seriesTitle: string) =>
    [...postsKeys.all, "series", seriesTitle] as const,
  searchInfiniteAll: () => [...postsKeys.all, "searchInfinite"] as const,
  searchInfinite: ({
    q,
    seriesTitle,
    tags,
    sortBy,
    dateRange,
    randomSeed,
    view,
  }: PostsSearchParams) =>
    [
      ...postsKeys.searchInfiniteAll(),
      { dateRange, q, randomSeed, seriesTitle, sortBy, tags, view },
    ] as const,
} as const;

export type PostsInfinitePage = {
  readonly data: readonly PostWithVotes[];
  meta: {
    pagination: PaginationMeta;
  };
};

export const postsNextPageParam = (
  lastPage: PostsInfinitePage,
  _allPages: readonly PostsInfinitePage[],
  lastPageParam: number,
): number | undefined =>
  lastPage.meta.pagination.hasMore ? lastPageParam + 1 : undefined;

export const postsPreviousPageParam = (
  firstPage: PostsInfinitePage,
  _allPages: readonly PostsInfinitePage[],
  firstPageParam: number,
): number | undefined =>
  firstPage.meta.pagination.hasPrevious ? firstPageParam - 1 : undefined;

export const computeAnchorPostIndex = (
  pageParams: readonly number[],
  anchorPage: number,
  pageItemCounts: readonly number[],
): number | null => {
  const anchorIdx = pageParams.indexOf(anchorPage);
  if (anchorIdx === -1) return null;
  return pageItemCounts
    .slice(0, anchorIdx)
    .reduce((sum, count) => sum + count, 0);
};
