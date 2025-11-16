import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { fetchPost, fetchPosts, searchPosts } from "./posts.fn";
import type { PaginatedPostsResponse } from "./posts.schema";

// Posts infinite query options
export const postsInfiniteQueryOptions = (q?: string) => {
  return infiniteQueryOptions({
    queryKey: ["posts", q],
    queryFn: async ({ pageParam }: { pageParam?: number }) => {
      if (q) {
        return searchPosts({
          data: {
            q,
            page: { size: 20, after: pageParam },
          },
        });
      }

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
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
  });
};

// Single post query options
export const postQueryOptions = (postId: number) => {
  return queryOptions({
    queryKey: ["posts", postId],
    queryFn: async () => {
      return fetchPost({
        data: postId,
      });
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};
