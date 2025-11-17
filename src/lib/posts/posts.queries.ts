import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { fetchPost, fetchPosts, searchPosts } from "./posts.fn";
import type { PaginatedPostsResponse } from "./posts.schema";

export const postsKeys = {
  all: ["posts"] as const,
  list: () => [...postsKeys.all, "list"] as const,
  search: (q: string) => [...postsKeys.all, "search", q] as const,
  detail: (postId: number) => [...postsKeys.all, "detail", postId] as const,
} as const;

// Centralized queryOptions factories for posts feature
export const postsQueries = {
  // List all posts with infinite scrolling
  list: () =>
    infiniteQueryOptions({
      queryKey: postsKeys.list(),
      queryFn: async ({ pageParam }: { pageParam?: number }) => {
        return fetchPosts({
          data: {
            page: { size: 20, after: pageParam },
          },
        });
      },
      initialPageParam: undefined as number | undefined,
      getNextPageParam: (lastPage: PaginatedPostsResponse) => {
        return lastPage?.meta?.hasMore
          ? lastPage?.meta?.cursors?.after
          : undefined;
      },
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
    }),
  // Search posts with infinite scrolling
  search: (q: string) =>
    infiniteQueryOptions({
      queryKey: postsKeys.search(q),
      queryFn: async ({ pageParam }: { pageParam?: number }) => {
        return searchPosts({
          data: {
            q,
            page: { size: 20, after: pageParam },
          },
        });
      },
      initialPageParam: undefined as number | undefined,
      getNextPageParam: (lastPage: PaginatedPostsResponse) => {
        return lastPage?.meta?.hasMore
          ? lastPage?.meta?.cursors?.after
          : undefined;
      },
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
    }),
  // Single post detail
  detail: (postId: number) =>
    queryOptions({
      queryKey: postsKeys.detail(postId),
      queryFn: async () => {
        return fetchPost({
          data: postId,
        });
      },
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
    }),
};

// Backward compatibility exports
export const postsInfiniteQueryOptions = (q?: string) => {
  return q ? postsQueries.search(q) : postsQueries.list();
};

export const postQueryOptions = (postId: number) => {
  return postsQueries.detail(postId);
};
