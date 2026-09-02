import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import {
  postsNextPageParam,
  postsPreviousPageParam,
} from "../posts/posts.queries";
import type { FetchUserInput } from "./users.schema";
import { fetchMentionableUsers, fetchUserPosts } from "./users.service";

export const usersKeys = {
  all: ["users"] as const,
  detail: ({ userId, q, tags }: FetchUserInput) =>
    [...usersKeys.all, "detail", { userId, q, tags }] as const,
  list: () => [...usersKeys.all, "list"] as const,
  userInfo: ["userInfo"] as const,
  accountSecurity: ["accountSecurity"] as const,
  userPostsInfinite: ({ userId, q, tags }: FetchUserInput) =>
    [...usersKeys.all, "userPostsInfinite", { userId, q, tags }] as const,
  mentionSearch: (query: string) =>
    [...usersKeys.all, "mentionSearch", query] as const,
} as const;

/**
 * @mention autocomplete for the comment composer: active users whose handle
 * starts with the query being typed after an `@`.
 */
export const mentionSearchQueryOptions = (query: string) =>
  queryOptions({
    queryKey: usersKeys.mentionSearch(query),
    queryFn: () => fetchMentionableUsers({ data: { query } }),
    // The server rejects empty queries; the composer only opens the
    // dropdown once at least one character is typed.
    enabled: query.length > 0,
    staleTime: 30 * 1000,
  });

export const userPostsInfiniteQueryOptions = (params: FetchUserInput) =>
  infiniteQueryOptions({
    gcTime: 10 * 60 * 1000, // 10 minutes
    getNextPageParam: postsNextPageParam,
    getPreviousPageParam: postsPreviousPageParam,
    initialPageParam: params.page,
    queryFn: async ({ pageParam }) =>
      fetchUserPosts({
        data: { ...params, page: pageParam },
      }),
    queryKey: usersKeys.userPostsInfinite(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
