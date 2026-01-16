import { queryOptions } from "@tanstack/react-query";
import { fetchPostDetail, getPostsByTag, searchPosts } from "./posts.fn";
import type { PostsSearchParams } from "./posts.schema";

export const postsKeys = {
  all: ["posts"] as const,
  byTag: (tagName: string) => [...postsKeys.all, "byTag", tagName] as const,
  detail: (postId: number) => [...postsKeys.all, "detail", postId] as const,
  list: (sortBy?: string, dateRange?: string) =>
    [...postsKeys.all, "list", { dateRange, sortBy }] as const,
  search: ({ dateRange, page, sortBy, q, tags }: PostsSearchParams) =>
    [...postsKeys.all, "search", dateRange, page, sortBy, q, tags] as const,
} as const;

// Centralized queryOptions factories for posts feature
const postsQueries = {
  byTag: ({ tag, page }: { tag: string; page: number }) =>
    queryOptions({
      gcTime: 5 * 60 * 1000, // 5 minutes
      queryFn: () => {
        return getPostsByTag({
          data: {
            page,
            tag,
          },
        });
      },
      queryKey: [...postsKeys.byTag(tag), page],
      staleTime: 60 * 1000, // 1 minute
    }),
  // Single post detail
  detail: (postId: number) =>
    queryOptions({
      gcTime: 5 * 60 * 1000, // 5 minutes
      queryFn: () => {
        return fetchPostDetail({
          data: postId,
        });
      },
      queryKey: postsKeys.detail(postId),
      staleTime: 60 * 1000, // 1 minute
    }),

  // Search posts with infinite scrolling
  search: (params: PostsSearchParams) =>
    queryOptions({
      gcTime: 5 * 60 * 1000,
      queryFn: () => {
        return searchPosts({
          data: params,
        });
      },
      queryKey: postsKeys.search(params),
      staleTime: 60 * 1000,
    }),
};

export const postsQueryOptions = (params: PostsSearchParams) => {
  return postsQueries.search(params);
};

export const postQueryDetail = (postId: number) => {
  return postsQueries.detail(postId);
};

export const postsQueryByTag = (params: { tag: string; page: number }) => {
  return postsQueries.byTag(params);
};
