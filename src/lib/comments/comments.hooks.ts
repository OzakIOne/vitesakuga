import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import { toaster } from "src/components/ui/toaster";

import { CommentsFnsContext } from "./comments.fn-context";
import { commentsKeys } from "./comments.queries";

export function useAddComment(postId: number, userId: string) {
  const queryClient = useQueryClient();
  const { addComment } = useContext(CommentsFnsContext);

  return useMutation({
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
      toaster.create({
        closable: true,
        description:
          error instanceof Error ? error.message : "Failed to add comment",
        duration: 5000,
        title: "Error adding comment",
        type: "error",
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: commentsKeys.post(postId),
      });
      toaster.create({
        closable: true,
        description: "Your comment has been successfully posted.",
        duration: 3000,
        title: "Comment added",
        type: "success",
      });
    },
  });
}

export function useDeleteComment(postId: number) {
  const queryClient = useQueryClient();
  const { deleteComment } = useContext(CommentsFnsContext);

  return useMutation({
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
      toaster.create({
        closable: true,
        description:
          error instanceof Error ? error.message : "Failed to delete comment",
        duration: 5000,
        title: "Error deleting comment",
        type: "error",
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: commentsKeys.post(postId),
      });
      toaster.create({
        closable: true,
        description: "Your comment has been successfully deleted.",
        duration: 3000,
        title: "Comment deleted",
        type: "success",
      });
    },
  });
}
