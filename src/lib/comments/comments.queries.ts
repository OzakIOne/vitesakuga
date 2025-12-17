import { queryOptions } from "@tanstack/react-query";
import { fetchComments } from "./comments.fn";

export const commentsKeys = {
  all: ["comments"] as const,
  post: (postId: number) => [...commentsKeys.all, "post", postId] as const,
} as const;

// Centralized queryOptions factories for comments feature
export const commentsQueries = {
  // Comments for a specific post
  getComments: (postId: number) =>
    queryOptions({
      gcTime: 5 * 60 * 1000, // 5 minutes
      queryFn: async () =>
        fetchComments({
          data: postId,
        }),
      queryKey: commentsKeys.post(postId),
      staleTime: 30 * 1000, // 30 seconds
    }),
};

// Backward compatibility export
export const commentsQueryGetComments = (postId: number) => {
  return commentsQueries.getComments(postId);
};
