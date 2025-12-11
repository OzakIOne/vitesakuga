import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { fetchUser, fetchUsers } from "./users.fn";

export const usersKeys = {
  all: ["users"] as const,
  user: ["user"] as const,
  list: () => [...usersKeys.all, "list"] as const,
  detail: (userId: string) => [...usersKeys.all, "detail", userId] as const,
} as const;

// Centralized queryOptions factories for users feature
export const usersQueries = {
  // List all users
  list: () =>
    queryOptions({
      queryKey: usersKeys.list(),
      queryFn: async () => {
        return fetchUsers();
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    }),
  // Single user detail with posts - using infinite pagination
  detail: (userId: string) =>
    infiniteQueryOptions({
      queryKey: usersKeys.detail(userId),
      queryFn: async ({ pageParam }: { pageParam?: number }) => {
        return fetchUser({
          data: {
            userId,
            page: { size: 20, after: pageParam },
          },
        });
      },
      initialPageParam: undefined as number | undefined,
      getNextPageParam: (lastPage) => {
        return lastPage?.meta?.hasMore
          ? lastPage?.meta?.cursors?.after
          : undefined;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    }),
};

// Backward compatibility exports
export const usersQueryOptions = () => {
  return usersQueries.list();
};

export const userQueryOptions = (userId: string) => {
  return usersQueries.detail(userId);
};
