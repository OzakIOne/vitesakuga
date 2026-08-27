import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchNotifications,
  markAllNotificationsRead,
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
  return useMutation({
    mutationFn: async () => markAllNotificationsRead(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: notificationKeys.inbox,
      });
    },
  });
}
