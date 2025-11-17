import { queryOptions } from "@tanstack/react-query";
import { fetchComments } from "./comments.fn";

export const commentsKeys = {
  all: ["comments"] as const,
  byPost: (postId: number) => [...commentsKeys.all, "byPost", postId] as const,
} as const;

// Centralized queryOptions factories for comments feature
export const commentsQueries = {
  // Comments for a specific post
  byPost: (postId: number) =>
    queryOptions({
      queryKey: commentsKeys.byPost(postId),
      queryFn: async () => {
        return fetchComments({
          data: postId,
        });
      },
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
    }),
};

// Backward compatibility export
export const commentsQueryOptions = (postId: number) => {
  return commentsQueries.byPost(postId);
};
