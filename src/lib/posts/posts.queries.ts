import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import {
  fetchPostDetail,
  fetchPosts,
  getPostsByTag,
  searchPosts,
} from "./posts.fn";
import type { PaginatedPostsResponse } from "./posts.schema";

export const postsKeys = {
  all: ["posts"] as const,
  list: () => [...postsKeys.all, "list"] as readonly string[],
  search: (q: string) => [...postsKeys.all, "search", q] as readonly string[],
  detail: (postId: number) => [...postsKeys.all, "detail", postId] as const,
  byTag: (tagName: string) => [...postsKeys.all, "byTag", tagName] as const,
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
        return fetchPostDetail({
          data: postId,
        });
      },
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
    }),
  byTag: (tagName: string) =>
    queryOptions({
      queryKey: postsKeys.byTag(tagName),
      queryFn: async () => {
        // This function should call the appropriate function to get posts by tag
        // For example, it could be getPostsByTag from tags.fn.ts
        return getPostsByTag({ data: tagName });
      },
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
    }),
};

// Backward compatibility exports
export const postsInfiniteQueryOptions = (q?: string) => {
  return q ? postsQueries.search(q) : postsQueries.list();
};

export const postQueryDetail = (postId: number) => {
  return postsQueries.detail(postId);
};

export const postsQueryByTag = (tagName: string) => {
  return postsQueries.byTag(tagName);
};
