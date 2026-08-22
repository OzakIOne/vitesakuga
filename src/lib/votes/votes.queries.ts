import { queryOptions } from "@tanstack/react-query";

import type { FetchLikedPostsInput } from "./votes.schema";
import { fetchLikedPosts, fetchPostVotes } from "./votes.service";

const votesKeysRoot = ["post-votes"] as const;

export const votesKeys = {
  all: votesKeysRoot,
  likedPosts: (params: FetchLikedPostsInput) =>
    [...votesKeysRoot, "liked-posts", params] as const,
  likedPostsAll: [...votesKeysRoot, "liked-posts"] as const,
  post: (postId: number) => [...votesKeysRoot, postId] as const,
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

  // Paginated virtual "Liked posts" playlist derived from the user's likes
  likedPosts: (params: FetchLikedPostsInput) =>
    queryOptions({
      gcTime: 5 * 60 * 1000, // 5 minutes
      queryFn: async () =>
        fetchLikedPosts({
          data: params,
        }),
      queryKey: votesKeys.likedPosts(params),
      staleTime: 30 * 1000, // 30 seconds
    }),
};

export const votesQueryGetVotes = (postId: number) =>
  votesQueries.getVotes(postId);

export const votesQueryLikedPosts = (params: FetchLikedPostsInput) =>
  votesQueries.likedPosts(params);
