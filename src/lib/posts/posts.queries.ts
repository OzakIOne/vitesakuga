import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import {
  fetchPostDetail,
  fetchPosts,
  getPostsByTag,
  searchPosts,
} from "./posts.fn";

export const postsKeys = {
  all: ["posts"] as const,
  byTag: (tagName: string) => [...postsKeys.all, "byTag", tagName] as const,
  detail: (postId: number) => [...postsKeys.all, "detail", postId] as const,
  list: () => [...postsKeys.all, "list"] as readonly string[],
  search: (q: string, tags: string[]) =>
    [...postsKeys.all, "search", q, { tags }] as const,
} as const;

// Centralized queryOptions factories for posts feature
export const postsQueries = {
  byTag: (tagName: string) =>
    infiniteQueryOptions({
      gcTime: 5 * 60 * 1000, // 5 minutes
      getNextPageParam: (lastPage) => {
        return lastPage?.meta?.hasMore
          ? lastPage?.meta?.cursors?.after
          : undefined;
      },
      initialPageParam: undefined as number | undefined,
      queryFn: async ({ pageParam }: { pageParam?: number }) => {
        return getPostsByTag({
          data: {
            page: { after: pageParam, size: 20 },
            tag: tagName,
          },
        });
      },
      queryKey: postsKeys.byTag(tagName),
      staleTime: 60 * 1000, // 1 minute
    }),
  // Single post detail
  detail: (postId: number) =>
    queryOptions({
      gcTime: 5 * 60 * 1000, // 5 minutes
      queryFn: async () => {
        return fetchPostDetail({
          data: postId,
        });
      },
      queryKey: postsKeys.detail(postId),
      staleTime: 60 * 1000, // 1 minute
    }),
  // List all posts with infinite scrolling
  list: () =>
    infiniteQueryOptions({
      gcTime: 5 * 60 * 1000, // 5 minutes
      getNextPageParam: (lastPage) => {
        return lastPage?.meta?.hasMore
          ? lastPage?.meta?.cursors?.after
          : undefined;
      },
      initialPageParam: undefined as number | undefined,
      queryFn: async ({ pageParam }: { pageParam?: number }) => {
        return fetchPosts({
          data: {
            page: { after: pageParam, size: 20 },
          },
        });
      },
      queryKey: postsKeys.list(),
      staleTime: 60 * 1000, // 1 minute
    }),
  // Search posts with infinite scrolling
  search: (q: string, tags: string[]) =>
    infiniteQueryOptions({
      gcTime: 5 * 60 * 1000, // 5 minutes
      getNextPageParam: (lastPage) => {
        return lastPage?.meta?.hasMore
          ? lastPage?.meta?.cursors?.after
          : undefined;
      },
      initialPageParam: undefined as number | undefined,
      queryFn: async ({ pageParam }: { pageParam?: number }) => {
        return searchPosts({
          data: {
            page: { after: pageParam, size: 20 },
            q,
            tags,
          },
        });
      },
      queryKey: postsKeys.search(q, tags),
      staleTime: 60 * 1000, // 1 minute
    }),
};

// Backward compatibility exports
export const postsInfiniteQueryOptions = (q: string, tags: string[]) => {
  if (q || tags.length > 0) return postsQueries.search(q, tags);

  return postsQueries.list();
};

export const postQueryDetail = (postId: number) => {
  return postsQueries.detail(postId);
};

export const postsQueryByTag = (tagName: string) => {
  return postsQueries.byTag(tagName);
};
