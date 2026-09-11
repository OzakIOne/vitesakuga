import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toastError } from "../mutations/mutation-feedback";
import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications.service";

export const notificationKeys = {
  inbox: ["notifications", "inbox"] as const,
};

const INBOX_STALE_MS = 15_000;
/** Light polling keeps the badge fresh without websockets or SSE. */
const REFETCH_INTERVAL_MS = 30_000;

/** The signed-in user's newest notifications (polled lightly). */
export function useNotifications() {
  return useQuery({
    queryFn: async ({ signal }) => fetchNotifications({ signal }),
    queryKey: notificationKeys.inbox,
    refetchInterval: REFETCH_INTERVAL_MS,
    staleTime: INBOX_STALE_MS,
  });
}

/** Unread count for the header badge. */
export function useUnreadNotificationCount(): number {
  const { data } = useNotifications();
  return (data ?? []).filter((row) => row.readAt === null).length;
}

/** Flips every unread row's readAt (client opens the inbox). */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    errorFallback: "Could not mark notifications as read. Try again.",
    errorTitle: "Inbox Update Failed",
    mutationFn: async () => markAllNotificationsRead(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: notificationKeys.inbox,
      });
    },
    successTitle: "Notifications Marked as Read",
  });
}

/** Marks one inbox row as read without producing a success toast per row. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: number) =>
      markNotificationRead({ data: notificationId }),
    onError: (error) => {
      toastError(
        "Inbox Update Failed",
        error,
        "Could not mark this notification as read. Try again.",
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.inbox });
    },
  });
}
