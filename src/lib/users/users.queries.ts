import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { fetchUserPosts, fetchUsers } from "./users.fn";

export const usersKeys = {
  all: ["users"] as const,
  detail: (userId: string, tags?: string[], q?: string) =>
    [...usersKeys.all, "detail", userId, { q, tags }] as const,
  list: () => [...usersKeys.all, "list"] as const,
  user: ["user"] as const,
} as const;

// Centralized queryOptions factories for users feature
export const usersQueries = {
  // Single user detail with posts - using infinite pagination
  detail: (userId: string, tags?: string[], q?: string) =>
    infiniteQueryOptions({
      gcTime: 10 * 60 * 1000, // 10 minutes
      getNextPageParam: (lastPage) => {
        return lastPage?.meta?.hasMore
          ? lastPage?.meta?.cursors?.after
          : undefined;
      },
      initialPageParam: undefined as number | undefined,
      queryFn: async ({ pageParam }: { pageParam?: number }) => {
        return fetchUserPosts({
          data: {
            page: { after: pageParam, size: 20 },
            q,
            tags,
            userId,
          },
        });
      },
      queryKey: usersKeys.detail(userId, tags, q),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),
  // List all users
  listUsers: () =>
    queryOptions({
      gcTime: 10 * 60 * 1000, // 10 minutes
      queryFn: async () => fetchUsers(),
      queryKey: usersKeys.list(),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),
};

// Backward compatibility exports
export const usersQueryOptions = () => {
  return usersQueries.listUsers();
};

export const userQueryOptions = (userId: string, tags: string[], q: string) => {
  return usersQueries.detail(userId, tags, q);
};
