import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import {
  postsKeys,
  postsNextPageParam,
  postsPreviousPageParam,
} from "./posts.queries";
import type { PostsSearchParams } from "./posts.schema";
import { fetchPostDetail, fetchSeriesHub, searchPosts } from "./posts.service";

// Centralized queryOptions factories for posts feature
const postsQueries = {
  // Single post detail
  detail: (postId: number) =>
    queryOptions({
      gcTime: 5 * 60 * 1000, // 5 minutes
      queryFn: () =>
        fetchPostDetail({
          data: postId,
        }),
      queryKey: postsKeys.detail(postId),
      staleTime: 60 * 1000, // 1 minute
    }),
  series: (seriesTitle: string) =>
    queryOptions({
      gcTime: 5 * 60 * 1000,
      queryFn: () =>
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
    queryFn: ({ pageParam }) =>
      searchPosts({
        data: {
          includePopularTags: pageParam === params.page,
          params: { ...params, page: pageParam },
        },
      }),
    queryKey: postsKeys.searchInfinite(params),
    staleTime: 60 * 1000,
  });

export const postQueryDetail = (postId: number) => postsQueries.detail(postId);

export const seriesHubQuery = (seriesTitle: string) =>
  postsQueries.series(seriesTitle);
