import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Button } from "src/components/ui/button";
import { Spinner } from "src/components/ui/feedback";
import { Container, HStack, Stack } from "src/components/ui/layout";
import { Heading, Text } from "src/components/ui/typography";
import {
  notificationKeys,
  useMarkAllNotificationsRead,
  useNotifications,
} from "src/lib/notifications/notifications.hooks";

export const Route = createFileRoute("/notifications")({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: NotificationsPage,
});

const notificationLabel = (type: string): string => {
  switch (type) {
    case "edit-suggestion-applied":
      return "An edit suggestion on one of your posts was applied.";
    case "promotion-approved":
      return "Your promotion to uploader was approved! 🎉";
    case "promotion-rejected":
      return "Your promotion request was declined. Earn more points and try again.";
    default:
      return type;
  }
};

function formatWhen(date: Date): string {
  const diffMs = Date.now() - new Date(date).valueOf();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

function NotificationsPage() {
  const inbox = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const queryClient = useQueryClient();

  const rows = inbox.data ?? [];
  const unreadCount = rows.filter((row) => row.readAt === null).length;

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: notificationKeys.inbox,
        });
      },
    });
  };

  return (
    <Container py={6}>
      <HStack justify="space-between">
        <Heading size="xl">Notifications</Heading>
        {unreadCount > 0 && (
          <Button
            loading={markAllRead.isPending}
            onClick={handleMarkAllRead}
            size="xs"
          >
            Mark all read ({unreadCount})
          </Button>
        )}
      </HStack>
      <Stack gap={2} mt={4}>
        {inbox.isPending && (
          <Stack align="center" justify="center" minH="200px">
            <Spinner size="lg" />
          </Stack>
        )}
        {!inbox.isPending && rows.length === 0 && (
          <Text>You have no notifications yet.</Text>
        )}
        {rows.map((row) => {
          const label = notificationLabel(row.type);
          return (
            <Stack
              bg={row.readAt === null ? "gray.50" : undefined}
              border="1px solid"
              borderRadius="md"
              gap={0}
              key={row.id}
              p={3}
            >
              <Text fontWeight={row.readAt === null ? "bold" : "normal"}>
                {label}
              </Text>
              <Text fontSize="sm">{formatWhen(row.createdAt)}</Text>
            </Stack>
          );
        })}
      </Stack>
    </Container>
  );
}
