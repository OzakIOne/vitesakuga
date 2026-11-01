import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import {
  postsNextPageParam,
  postsPreviousPageParam,
} from "../posts/posts.queries";
import { usersKeys } from "./users.queries";
import type { FetchUserInput } from "./users.schema";
import {
  fetchContributorProfile,
  fetchMentionableUsers,
  fetchUserPosts,
} from "./users.service";

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

export const contributorProfileQueryOptions = (userId: string) =>
  queryOptions({
    queryFn: () => fetchContributorProfile({ data: { userId } }),
    queryKey: usersKeys.profile(userId),
    staleTime: 5 * 60 * 1000,
  });
