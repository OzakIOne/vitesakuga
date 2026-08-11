import { useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";

import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import { CommentsFnsContext } from "./comments.fn-context";
import { commentsKeys } from "./comments.queries";

export function useAddComment(postId: number, userId: string) {
  const queryClient = useQueryClient();
  const { addComment } = useContext(CommentsFnsContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to add comment",
    errorTitle: "Error adding comment",
    mutationFn: async (content: string) =>
      addComment({ data: { postId, content, userId } }),
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: commentsKeys.post(postId) });
      const previous = queryClient.getQueryData(commentsKeys.post(postId));
      queryClient.setQueryData(commentsKeys.post(postId), (old: unknown) => {
        const optimistic = {
          id: -Date.now(),
          postId,
          content,
          userId,
          createdAt: new Date(),
          userName: "You",
          userImage: null,
        };
        return old ? [optimistic, ...(old as unknown[])] : [optimistic];
      });
      return { previous };
    },
    onError: (error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(commentsKeys.post(postId), context.previous);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: commentsKeys.post(postId),
      });
    },
    successDescription: "Your comment has been successfully posted.",
    successTitle: "Comment added",
  });
}

export function useDeleteComment(postId: number) {
  const queryClient = useQueryClient();
  const { deleteComment } = useContext(CommentsFnsContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to delete comment",
    errorTitle: "Error deleting comment",
    mutationFn: async (data: { commentId: number }) => deleteComment({ data }),
    onMutate: async ({ commentId }) => {
      await queryClient.cancelQueries({ queryKey: commentsKeys.post(postId) });
      const previous = queryClient.getQueryData(commentsKeys.post(postId));
      queryClient.setQueryData(commentsKeys.post(postId), (old: unknown) =>
        (old as Array<{ id: number }> | undefined)?.filter(
          (c) => c.id !== commentId,
        ),
      );
      return { previous };
    },
    onError: (error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(commentsKeys.post(postId), context.previous);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: commentsKeys.post(postId),
      });
    },
    successDescription: "Your comment has been successfully deleted.",
    successTitle: "Comment deleted",
  });
}
