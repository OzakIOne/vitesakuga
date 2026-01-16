import { queryOptions } from "@tanstack/react-query";
import { fetchUserPosts, fetchUsers } from "./users.fn";
import type { FetchUserInput } from "./users.schema";

export const usersKeys = {
  all: ["users"] as const,
  detail: ({ userId, tags, q, page }: FetchUserInput) => [
    ...usersKeys.all,
    "detail",
    userId,
    q,
    tags,
    page,
  ],
  list: () => [...usersKeys.all, "list"] as const,
  userInfo: ["userInfo"] as const,
} as const;

// Centralized queryOptions factories for users feature
const usersQueries = {
  // Single user detail with posts
  detail: (params: FetchUserInput) =>
    queryOptions({
      gcTime: 10 * 60 * 1000, // 10 minutes
      queryFn: async () => {
        return fetchUserPosts({
          data: params,
        });
      },
      queryKey: usersKeys.detail(params),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),
  listUsers: () =>
    queryOptions({
      gcTime: 10 * 60 * 1000, // 10 minutes
      queryFn: async () => fetchUsers(),
      queryKey: usersKeys.list(),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),
};

export const usersQueryOptions = () => {
  return usersQueries.listUsers();
};

export const userQueryOptions = (params: FetchUserInput) => {
  return usersQueries.detail(params);
};
