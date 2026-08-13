import { queryOptions } from "@tanstack/react-query";

import { fetchPostVotes } from "./votes.service";

export const votesKeys = {
  all: ["post-votes"] as const,
  post: (postId: number) => [...votesKeys.all, postId] as const,
} as const;

// Centralized queryOptions factories for the post votes feature
const votesQueries = {
  // Vote summary for a single post (counts + current user's vote)
  getVotes: (postId: number) =>
    queryOptions({
      gcTime: 5 * 60 * 1000, // 5 minutes
      queryFn: async () =>
        fetchPostVotes({
          data: postId,
        }),
      queryKey: votesKeys.post(postId),
      staleTime: 30 * 1000, // 30 seconds
    }),
};

export const votesQueryGetVotes = (postId: number) =>
  votesQueries.getVotes(postId);
