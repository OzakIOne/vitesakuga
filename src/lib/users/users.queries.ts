import { queryOptions } from "@tanstack/react-query";

import type { FetchUserInput } from "./users.schema";
import { fetchUserPosts, fetchUsers } from "./users.service";

export const usersKeys = {
  all: ["users"] as const,
  detail: (params: FetchUserInput) => [...usersKeys.all, "detail", params],
  list: () => [...usersKeys.all, "list"] as const,
  userInfo: ["userInfo"] as const,
} as const;

// Centralized queryOptions factories for users feature
const usersQueries = {
  // Single user detail with posts
  detail: (params: FetchUserInput) =>
    queryOptions({
      gcTime: 10 * 60 * 1000, // 10 minutes
      queryFn: async () =>
        fetchUserPosts({
          data: params,
        }),
      queryKey: usersKeys.detail(params),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),
};

export const userQueryOptions = (params: FetchUserInput) =>
  usersQueries.detail(params);
