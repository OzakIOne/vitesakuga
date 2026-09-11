import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ListSkeleton } from "src/components/LoadingSkeletons";
import { Button } from "src/components/ui/button";
import { Alert } from "src/components/ui/feedback";
import { Container, HStack, Stack } from "src/components/ui/layout";
import { Heading, Text } from "src/components/ui/typography";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "src/lib/notifications/notifications.hooks";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/notifications")({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: NotificationsPage,
  head: () => ({
    meta: seo({
      description: "Review your ViteSakuga notifications.",
      noIndex: true,
      title: "Notifications · ViteSakuga",
    }),
  }),
});

const notificationLabel = (type: string): string => {
  switch (type) {
    case "comment-mention":
      return "You were mentioned in a comment.";
    case "edit-suggestion-applied":
      return "An edit suggestion on one of your posts was applied.";
    case "edit-suggestion-approved":
      return "Your edit suggestion was approved and applied.";
    case "edit-suggestion-rejected":
      return "Your edit suggestion was rejected.";
    case "promotion-approved":
      return "Your promotion to uploader was approved! 🎉";
    case "promotion-rejected":
      return "Your promotion request was declined. Earn more points and try again.";
    default:
      return type;
  }
};

const relativeTime = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

function formatWhen(date: Date | string): string {
  const diffMs = Date.now() - new Date(date).valueOf();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return relativeTime.format(0, "second");
  if (minutes < 60) return relativeTime.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relativeTime.format(-hours, "hour");
  return relativeTime.format(-Math.floor(hours / 24), "day");
}

function NotificationsPage() {
  const inbox = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();

  const rows = inbox.data ?? [];
  const unreadCount = rows.filter((row) => row.readAt === null).length;

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  return (
    <Container py={6}>
      <HStack justify="space-between">
        <Heading as="h1" size="xl">
          Notifications
        </Heading>
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
        {inbox.isPending && <ListSkeleton count={4} />}
        {inbox.isError && (
          <Alert.Root status="error">
            <Alert.Content>
              <Alert.Indicator status="error" />
              <div>
                <Alert.Title>Could Not Load Notifications</Alert.Title>
                <Alert.Description>
                  Refresh the inbox and try again.
                </Alert.Description>
                <Button
                  className="mt-3"
                  onClick={() => void inbox.refetch()}
                  size="sm"
                >
                  Retry
                </Button>
              </div>
            </Alert.Content>
          </Alert.Root>
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
              <HStack align="start" justify="space-between">
                {row.postId !== null ? (
                  <Link
                    className="hover:underline"
                    params={{ postId: String(row.postId) }}
                    to="/posts/$postId"
                  >
                    <Text fontWeight={row.readAt === null ? "bold" : "normal"}>
                      {label}
                    </Text>
                  </Link>
                ) : (
                  <Text fontWeight={row.readAt === null ? "bold" : "normal"}>
                    {label}
                  </Text>
                )}
                {row.readAt === null && (
                  <Button
                    loading={
                      markRead.isPending && markRead.variables === row.id
                    }
                    onClick={() => markRead.mutate(row.id)}
                    size="xs"
                    variant="ghost"
                  >
                    Mark as Read
                  </Button>
                )}
              </HStack>
              <Text fontSize="sm">{formatWhen(row.createdAt)}</Text>
            </Stack>
          );
        })}
      </Stack>
    </Container>
  );
}
