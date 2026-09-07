import { useQueryClient } from "@tanstack/react-query";

import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import { postEditsKeys } from "./post-edits.queries";
import type { PostEditPayload } from "./post-edits.schema";
import { approveEdit, proposeEdit, rejectEdit } from "./post-edits.service";

export function useProposeEdit(postId: number) {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    errorFallback: "Could not submit your edit suggestion.",
    errorTitle: "Edit suggestion failed",
    mutationFn: async (payload: PostEditPayload) =>
      proposeEdit({ data: { payload, postId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: postEditsKeys.post(postId),
      });
    },
    successDescription: "The community can now review your changes.",
    successTitle: "Edit suggestion submitted",
  });
}

export function useApprovePostEdit(postId: number) {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    errorFallback: "Could not approve this suggestion.",
    errorTitle: "Suggestion approval failed",
    mutationFn: async (editId: number) => approveEdit({ data: { editId } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: postEditsKeys.post(postId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["posts", "detail", postId],
        }),
      ]);
    },
    successDescription: "Your approval has been recorded.",
    successTitle: "Suggestion approved",
  });
}

export function useRejectPostEdit(postId: number) {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    errorFallback: "Could not reject this suggestion.",
    errorTitle: "Suggestion rejection failed",
    mutationFn: async (editId: number) => rejectEdit({ data: { editId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: postEditsKeys.post(postId),
      });
    },
    successDescription: "The suggestion was rejected.",
    successTitle: "Suggestion rejected",
  });
}

/** Kept local to the post page so it can render review actions without auth-only queries. */
