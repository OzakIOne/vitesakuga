import type { FetchUserInput } from "./users.schema";

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
  profile: (userId: string) => [...usersKeys.all, "profile", userId] as const,
} as const;
