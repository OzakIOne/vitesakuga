import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { fetchPostDetail, getPostsByTag, searchPosts } from "./posts.fn";
import type { PostsSearchParams } from "./posts.schema";

export const postsKeys = {
  all: ["posts"] as const,
  byTag: (tagName: string) => [...postsKeys.all, "byTag", tagName] as const,
  detail: (postId: number) => [...postsKeys.all, "detail", postId] as const,
  list: (sortBy?: string, dateRange?: string) =>
    [...postsKeys.all, "list", { dateRange, sortBy }] as const,
  search: (q: string, tags: string[], sortBy?: string, dateRange?: string) =>
    [...postsKeys.all, "search", q, { dateRange, sortBy, tags }] as const,
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
  list: (
    sortBy: string,
    dateRange: string,
    initialPage: number,
    pageSize: number,
  ) => postsQueries.search("", [], sortBy, dateRange, initialPage, pageSize),

  // Search posts with infinite scrolling
  search: (
    q: string,
    tags: string[],
    sortBy: string,
    dateRange: string,
    initialPage: number,
    pageSize: number,
  ) =>
    infiniteQueryOptions({
      gcTime: 5 * 60 * 1000,
      getNextPageParam: (lastPage) => {
        const { currentPage, totalPages } = lastPage.meta.pagination;
        return currentPage < totalPages ? currentPage + 1 : undefined;
      },
      getPreviousPageParam: (firstPage) => {
        const { currentPage } = firstPage.meta.pagination;
        return currentPage > 1 ? currentPage - 1 : undefined;
      },
      initialPageParam: initialPage,
      maxPages: 10, // Keep max 10 pages in memory to prevent excessive memory usage
      queryFn: async ({ pageParam }: { pageParam: number }) => {
        return searchPosts({
          data: {
            dateRange,
            page: {
              offset: (pageParam - 1) * pageSize,
              size: pageSize,
            },
            q,
            sortBy,
            tags,
          },
        });
      },
      queryKey: postsKeys.search(q, tags, sortBy, dateRange),
      staleTime: 60 * 1000,
    }),
};

// Backward compatibility exports
export const postsInfiniteQueryOptions = (
  q: PostsSearchParams["q"],
  tags: PostsSearchParams["tags"],
  sortBy: PostsSearchParams["sortBy"],
  dateRange: PostsSearchParams["dateRange"],
  initialPage: number,
  pageSize: number,
) => {
  return postsQueries.search(q, tags, sortBy, dateRange, initialPage, pageSize);
};

export const postQueryDetail = (postId: number) => {
  return postsQueries.detail(postId);
};

export const postsQueryByTag = (tagName: string) => {
  return postsQueries.byTag(tagName);
};
