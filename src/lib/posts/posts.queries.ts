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
const postsQueries = {
  byTag: (tagName: string, page: number, pageSize: number) =>
    queryOptions({
      gcTime: 5 * 60 * 1000, // 5 minutes
      queryFn: () => {
        return getPostsByTag({
          data: {
            page,
            pageSize,
            tag: tagName,
          },
        });
      },
      queryKey: [...postsKeys.byTag(tagName), page, pageSize],
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
    page: number,
    pageSize: number,
  ) =>
    queryOptions({
      gcTime: 5 * 60 * 1000,
      queryFn: () => {
        return searchPosts({
          data: {
            dateRange,
            page, // 1-based page from UI, or 0-based?
            // The server function now expects `page: number` (0-based per earlier plan for API, but UI usually 1-based).
            // Wait, my server implementation used `const offset = page * pageSize;`
            // So if I pass page=0, offset=0. If page=1, offset=30.
            // If the UI is 1-based (page=1), I should pass page-1 to server if server expects 0-based index.
            // Let's check `posts.fn.ts`.
            // `const { page, pageSize } = data; const offset = page * pageSize;`
            // Yes, so server expects 0-based page index.
            // If UI uses 1-based, I should subtract 1 here.
            // However, the `posts/index.tsx` probably handles the page number.
            // Let's decided: `posts.queries.ts` takes the "raw" value from the route?
            // The route usually has `page: 1` as default.
            // So if route has page=1, query should pass page=0 to server.
            // ERROR: I previously decided `page` in server schema is 0-based.
            // But `postsSearchSchema` in `posts.schema.ts` (for the ROUTE) has `page: z.number().int().min(1).optional().default(1)`.
            // So the route has 1-based page.
            // So here in queryOptions, I should convert.
            // `page: page - 1`
            pageSize,
            q,
            sortBy,
            tags,
          },
        });
      },
      queryKey: [
        ...postsKeys.search(q, tags, sortBy, dateRange),
        page,
        pageSize,
      ],
      staleTime: 60 * 1000,
    }),
};

// Backward compatibility exports
// Renamed to match behavior, though keeping export for now might break consumers expecting infinite query options.
// But `index.tsx` is the consumer calling this, so I will update `index.tsx` to call `postsQueryOptions`.
export const postsQueryOptions = (
  q: PostsSearchParams["q"],
  tags: PostsSearchParams["tags"],
  sortBy: PostsSearchParams["sortBy"],
  dateRange: PostsSearchParams["dateRange"],
  page: number,
  pageSize: number,
) => {
  return postsQueries.search(q, tags, sortBy, dateRange, page - 1, pageSize);
};

export const postQueryDetail = (postId: number) => {
  return postsQueries.detail(postId);
};

export const postsQueryByTag = (
  tagName: string,
  page: number,
  pageSize: number,
) => {
  return postsQueries.byTag(tagName, page - 1, pageSize);
};
