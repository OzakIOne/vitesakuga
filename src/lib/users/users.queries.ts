import { queryOptions } from "@tanstack/react-query";
import { fetchUser, fetchUsers } from "./users.fn";

export const usersQueryOptions = () => {
  return queryOptions({
    queryKey: ["users"],
    queryFn: async () => {
      return fetchUsers();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const userQueryOptions = (userId: string) => {
  return queryOptions({
    queryKey: ["users", userId],
    queryFn: async () => {
      return fetchUser({
        data: userId,
      });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
