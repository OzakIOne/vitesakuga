import { infiniteQueryOptions } from "@tanstack/react-query";

import {
  postsNextPageParam,
  postsPreviousPageParam,
} from "../posts/posts.queries";
import type { FetchUserInput } from "./users.schema";
import { fetchUserPosts } from "./users.service";

export const usersKeys = {
  all: ["users"] as const,
  detail: ({ userId, q, tags }: FetchUserInput) =>
    [...usersKeys.all, "detail", { userId, q, tags }] as const,
  list: () => [...usersKeys.all, "list"] as const,
  userInfo: ["userInfo"] as const,
  userPostsInfinite: ({ userId, q, tags }: FetchUserInput) =>
    [...usersKeys.all, "userPostsInfinite", { userId, q, tags }] as const,
} as const;

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
