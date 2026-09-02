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
      addComment({ data: { postId, content } }),
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: commentsKeys.post(postId) });
      const previous = queryClient.getQueryData(commentsKeys.post(postId));
      queryClient.setQueryData(commentsKeys.post(postId), (old) => {
        const optimistic = {
          id: -Date.now(),
          postId,
          content,
          userId,
          createdAt: new Date(),
          userName: "You",
          userImage: null,
          // Mentions resolve server-side; the cache is invalidated right
          // after, so the optimistic row renders without links.
          mentions: [],
        };
        // SAFETY: the optimistic comment list is homogeneous (all rows are
        // comment objects); unknown[] keeps the updater agnostic to the cache shape.
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

export function useUpdateComment(postId: number) {
  const queryClient = useQueryClient();
  const { updateComment } = useContext(CommentsFnsContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to update comment",
    errorTitle: "Error updating comment",
    mutationFn: async (data: { commentId: number; content: string }) =>
      updateComment({ data }),
    onMutate: async ({ commentId, content }) => {
      await queryClient.cancelQueries({ queryKey: commentsKeys.post(postId) });
      const previous = queryClient.getQueryData(commentsKeys.post(postId));
      // SAFETY: the cached list holds comment rows; matching on id and patching
      // content only touches the fields the update mutates.
      queryClient.setQueryData(commentsKeys.post(postId), (old) =>
        (old as Array<{ id: number; content: string }> | undefined)?.map((c) =>
          c.id === commentId ? { ...c, content } : c,
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
    successDescription: "Your comment has been successfully updated.",
    successTitle: "Comment updated",
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
      // SAFETY: the cached list holds comment rows; the filter predicate only uses
      // each row's id, so a minimal shape assertion is enough for the updater.
      queryClient.setQueryData(commentsKeys.post(postId), (old) =>
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
