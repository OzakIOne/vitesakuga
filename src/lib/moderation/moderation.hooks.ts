import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import {
  approveEdit as approveEditFn,
  rejectEdit as rejectEditFn,
} from "../post-edits/post-edits.service";
import {
  approvePromotion as approvePromotionFn,
  rejectPromotion as rejectPromotionFn,
} from "../promotions/promotions.service";
import { assignUserRole, fetchModerationOverview } from "./moderation.service";

export const moderationKeys = {
  overview: ["moderation", "overview"] as const,
};

const QUEUE_STALE_MS = 15_000;

/** Staff queue overview (reports + pending edit suggestions). */
export function useModerationOverview() {
  return useQuery({
    queryFn: async ({ signal }) => fetchModerationOverview({ signal }),
    queryKey: moderationKeys.overview,
    staleTime: QUEUE_STALE_MS,
  });
}

/** Approves a promotion candidate (staff). */
export function useApprovePromotion() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    errorFallback: "Could not approve this promotion.",
    errorTitle: "Promotion approval failed",
    mutationFn: async (userId: string) => approvePromotionFn({ data: userId }),
    onMutate: () => undefined,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: moderationKeys.overview,
      });
    },
    successDescription: "The user is now an uploader.",
    successTitle: "Promotion approved",
  });
}

/** Rejects a promotion candidate; they return once they out-earn the snapshot. */
export function useRejectPromotion() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    errorFallback: "Could not reject this promotion.",
    errorTitle: "Promotion rejection failed",
    mutationFn: async (userId: string) => rejectPromotionFn({ data: userId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: moderationKeys.overview,
      });
    },
    successDescription:
      "They may re-enter the queue after earning more points.",
    successTitle: "Promotion rejected",
  });
}

/** Applies an edit suggestion immediately (staff/owner). */
export function useApproveEdit() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    errorFallback: "Could not apply this suggestion.",
    errorTitle: "Suggestion approval failed",
    mutationFn: async (editId: number) => approveEditFn({ data: { editId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: moderationKeys.overview,
      });
    },
    successDescription: "Changes were applied to the post.",
    successTitle: "Suggestion applied",
  });
}

/** Rejects a pending edit suggestion. */
export function useRejectEdit() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    errorFallback: "Could not reject this suggestion.",
    errorTitle: "Suggestion rejection failed",
    mutationFn: async (editId: number) => rejectEditFn({ data: { editId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: moderationKeys.overview,
      });
    },
    successDescription: "The suggestion was discarded.",
    successTitle: "Suggestion rejected",
  });
}

/** Admin-only direct rank assignment. */
export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { role: string; userId: string }) =>
      assignUserRole({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: moderationKeys.overview,
      });
    },
  });
}
