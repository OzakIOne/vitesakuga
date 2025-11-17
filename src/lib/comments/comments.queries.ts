import { queryOptions } from "@tanstack/react-query";
import { fetchComments } from "./comments.fn";

export const commentsQueryOptions = (postId: number) => {
  return queryOptions({
    queryKey: ["comments", postId],
    queryFn: async () => {
      return fetchComments({
        data: postId,
      });
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};
