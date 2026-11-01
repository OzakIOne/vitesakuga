import type { FetchLikedPostsInput } from "./votes.schema";

const votesKeysRoot = ["post-votes"] as const;

export const votesKeys = {
  all: votesKeysRoot,
  likedPosts: (params: FetchLikedPostsInput) =>
    [...votesKeysRoot, "liked-posts", params] as const,
  likedPostsAll: [...votesKeysRoot, "liked-posts"] as const,
  post: (postId: number) => [...votesKeysRoot, postId] as const,
} as const;
