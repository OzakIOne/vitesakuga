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
    onError: (error) => {
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
    onError: (error) => {
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
