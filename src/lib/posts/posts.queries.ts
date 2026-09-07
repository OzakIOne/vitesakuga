import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import type { PostWithVotes } from "../db/schema";
import type { PaginationMeta } from "../pagination/pagination";
import type { PostsSearchParams } from "./posts.schema";
import { fetchPostDetail, fetchSeriesHub, searchPosts } from "./posts.service";

export const postsKeys = {
  all: ["posts"] as const,
  detail: (postId: number) => [...postsKeys.all, "detail", postId] as const,
  search: (params: PostsSearchParams) =>
    [...postsKeys.all, "search", params] as const,
  series: (seriesTitle: string) =>
    [...postsKeys.all, "series", seriesTitle] as const,
  searchInfinite: ({
    q,
    seriesTitle,
    tags,
    sortBy,
    dateRange,
  }: PostsSearchParams) =>
    [
      ...postsKeys.all,
      "searchInfinite",
      { q, seriesTitle, tags, sortBy, dateRange },
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

// Centralized queryOptions factories for posts feature
const postsQueries = {
  // Single post detail
  detail: (postId: number) =>
    queryOptions({
      gcTime: 5 * 60 * 1000, // 5 minutes
      queryFn: async () =>
        fetchPostDetail({
          data: postId,
        }),
      queryKey: postsKeys.detail(postId),
      staleTime: 60 * 1000, // 1 minute
    }),
  series: (seriesTitle: string) =>
    queryOptions({
      gcTime: 5 * 60 * 1000,
      queryFn: async () =>
        fetchSeriesHub({
          data: { seriesTitle },
        }),
      queryKey: postsKeys.series(seriesTitle),
      staleTime: 60 * 1000,
    }),
};

export const postsInfiniteQueryOptions = (params: PostsSearchParams) =>
  infiniteQueryOptions({
    gcTime: 5 * 60 * 1000,
    getNextPageParam: postsNextPageParam,
    getPreviousPageParam: postsPreviousPageParam,
    initialPageParam: params.page,
    queryFn: async ({ pageParam }) =>
      searchPosts({
        data: { ...params, page: pageParam },
      }),
    queryKey: postsKeys.searchInfinite(params),
    staleTime: 60 * 1000,
  });

export const postQueryDetail = (postId: number) => postsQueries.detail(postId);

export const seriesHubQuery = (seriesTitle: string) =>
  postsQueries.series(seriesTitle);
