import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import { useModerationFns } from "./moderation.fn-context";

export const moderationKeys = {
  gcPreview: ["moderation", "gc-preview"] as const,
  overview: ["moderation", "overview"] as const,
  promotionQueue: ["moderation", "promotion-queue"] as const,
};

const QUEUE_STALE_MS = 15_000;
const GC_STALE_MS = 60_000;

/** Staff queue overview (reports + pending edit suggestions). */
export function useModerationOverview() {
  const { fetchModerationOverview } = useModerationFns();
  return useQuery({
    queryFn: async ({ signal }) => fetchModerationOverview({ signal }),
    queryKey: moderationKeys.overview,
    staleTime: QUEUE_STALE_MS,
  });
}

/** Staff promotion queue: novices awaiting an approve or reject decision. */
export function usePromotionQueue() {
  const { fetchPromotionQueue } = useModerationFns();
  return useQuery({
    queryFn: async ({ signal }) => fetchPromotionQueue({ signal }),
    queryKey: moderationKeys.promotionQueue,
    staleTime: QUEUE_STALE_MS,
  });
}

/** Admin dry-run of storage cleanup: expired revisions and orphaned objects. */
export function useStorageGcPreview() {
  const { previewGc } = useModerationFns();
  return useQuery({
    queryFn: async ({ signal }) => previewGc({ signal }),
    queryKey: moderationKeys.gcPreview,
    staleTime: GC_STALE_MS,
  });
}

/** Runs the storage cleanup sweep, then refreshes the dry-run listing. */
export function useRunStorageGc() {
  const queryClient = useQueryClient();
  const { runGc } = useModerationFns();
  return useMutation({
    mutationFn: async () => runGc(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: moderationKeys.gcPreview,
      });
    },
  });
}

/** Approves a promotion candidate (staff). */
export function useApprovePromotion() {
  const queryClient = useQueryClient();
  const { approvePromotion } = useModerationFns();
  return useMutationWithFeedback({
    errorFallback: "Could not approve this promotion.",
    errorTitle: "Promotion approval failed",
    mutationFn: async (userId: string) => approvePromotion({ data: userId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: moderationKeys.promotionQueue,
      });
    },
    successDescription: "The user is now an uploader.",
    successTitle: "Promotion approved",
  });
}

/** Rejects a promotion candidate; they return once they out-earn the snapshot. */
export function useRejectPromotion() {
  const queryClient = useQueryClient();
  const { rejectPromotion } = useModerationFns();
  return useMutationWithFeedback({
    errorFallback: "Could not reject this promotion.",
    errorTitle: "Promotion rejection failed",
    mutationFn: async (userId: string) => rejectPromotion({ data: userId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: moderationKeys.promotionQueue,
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
  const { approveEdit } = useModerationFns();
  return useMutationWithFeedback({
    errorFallback: "Could not apply this suggestion.",
    errorTitle: "Suggestion approval failed",
    mutationFn: async (editId: number) => approveEdit({ data: { editId } }),
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
  const { rejectEdit } = useModerationFns();
  return useMutationWithFeedback({
    errorFallback: "Could not reject this suggestion.",
    errorTitle: "Suggestion rejection failed",
    mutationFn: async (editId: number) => rejectEdit({ data: { editId } }),
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
  const { assignUserRole } = useModerationFns();
  return useMutationWithFeedback({
    errorFallback: "Could not assign this role.",
    errorTitle: "Role assignment failed",
    mutationFn: async (input: { role: string; userId: string }) =>
      assignUserRole({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: moderationKeys.promotionQueue,
      });
    },
    successTitle: "Role assigned",
  });
}
