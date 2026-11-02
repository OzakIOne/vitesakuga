import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import { useModerationFns } from "./moderation.fn-context";

export const moderationKeys = {
  accountModerationEvents: ["moderation", "account-moderation-events"] as const,
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

/** Admin audit history for role changes and account suspensions. */
export function useAccountModerationEvents() {
  const { fetchAccountModerationEvents } = useModerationFns();
  return useQuery({
    queryFn: async ({ signal }) =>
      fetchAccountModerationEvents({ data: {}, signal }),
    queryKey: moderationKeys.accountModerationEvents,
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
  return useMutationWithFeedback({
    errorFallback: "Could not run storage cleanup.",
    errorTitle: "Storage cleanup failed",
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
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: moderationKeys.accountModerationEvents,
        }),
        queryClient.invalidateQueries({
          queryKey: moderationKeys.promotionQueue,
        }),
      ]);
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
/** Suspends an account (moderator or admin). Its queued work stays visible to staff. */
export function useSuspendUser() {
  const queryClient = useQueryClient();
  const { suspendUser } = useModerationFns();
  return useMutationWithFeedback({
    errorFallback: "Could not suspend this account.",
    errorTitle: "Suspension failed",
    mutationFn: async (input: { reason: string; userId: string }) =>
      suspendUser({ data: input }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: moderationKeys.accountModerationEvents,
        }),
        queryClient.invalidateQueries({ queryKey: moderationKeys.overview }),
        queryClient.invalidateQueries({
          queryKey: moderationKeys.promotionQueue,
        }),
      ]);
    },
    successDescription: "The account can still sign in but cannot act.",
    successTitle: "Account suspended",
  });
}

/** Lifts a suspension (moderator or admin). */
export function useUnsuspendUser() {
  const queryClient = useQueryClient();
  const { unsuspendUser } = useModerationFns();
  return useMutationWithFeedback({
    errorFallback: "Could not restore this account.",
    errorTitle: "Restore failed",
    mutationFn: async (userId: string) => unsuspendUser({ data: { userId } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: moderationKeys.accountModerationEvents,
        }),
        queryClient.invalidateQueries({ queryKey: moderationKeys.overview }),
        queryClient.invalidateQueries({
          queryKey: moderationKeys.promotionQueue,
        }),
      ]);
    },
    successDescription: "The account can act again.",
    successTitle: "Account restored",
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  const { assignUserRole } = useModerationFns();
  return useMutationWithFeedback({
    errorFallback: "Could not assign this role.",
    errorTitle: "Role assignment failed",
    mutationFn: async (input: {
      reason?: string;
      role: string;
      userId: string;
    }) => assignUserRole({ data: input }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: moderationKeys.accountModerationEvents,
        }),
        queryClient.invalidateQueries({
          queryKey: moderationKeys.promotionQueue,
        }),
      ]);
    },
    successTitle: "Role assigned",
  });
}
