import { trim } from "effect/String";
import { useState } from "react";
import { Button } from "src/components/ui/button";
import { Alert } from "src/components/ui/feedback";
import { Input } from "src/components/ui/field";
import { HStack, Stack } from "src/components/ui/layout";
import { Heading, Text } from "src/components/ui/typography";
import {
  useSuspendUser,
  useUnsuspendUser,
} from "src/lib/moderation/moderation.hooks";

type Feedback = {
  message: string;
  status: "error" | "success";
};

/**
 * Moderator and admin account suspension. A suspended account keeps reading
 * and signing in, but every action that changes content is refused.
 */
export function AccountSuspensionPanel() {
  const suspend = useSuspendUser();
  const restore = useUnsuspendUser();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const handleSuspend = (userId: string, reason: string) => {
    setFeedback(null);
    suspend.mutate(
      { reason, userId },
      {
        onError: () =>
          setFeedback({
            message: `Could not suspend ${userId}.`,
            status: "error",
          }),
        onSuccess: () =>
          setFeedback({
            message: `${userId} is suspended.`,
            status: "success",
          }),
      },
    );
  };

  const handleRestore = (userId: string) => {
    setFeedback(null);
    restore.mutate(userId, {
      onError: () =>
        setFeedback({
          message: `Could not restore ${userId}.`,
          status: "error",
        }),
      onSuccess: () =>
        setFeedback({ message: `${userId} is restored.`, status: "success" }),
    });
  };

  return (
    <Stack gap={4}>
      <Heading as="h2" size="lg">
        Account suspension
      </Heading>
      <Text>
        A suspended account can still read and sign in, but cannot post,
        comment, vote, report, suggest edits, or review. The reason is shown to
        the account. Moderators cannot suspend other moderators or admins.
      </Text>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          // SAFETY: the form renders <input name="userId"> and
          // <input name="reason">; FormData.get returns their string values,
          // and the non-empty check below guards empty input.
          const userId = trim((form.get("userId") ?? "") as string);
          // SAFETY: see above; the reason is validated again by the server.
          const reason = trim((form.get("reason") ?? "") as string);
          if (userId !== "" && reason !== "") {
            handleSuspend(userId, reason);
          }
        }}
      >
        <Stack gap={2}>
          <HStack gap={2}>
            <Input
              aria-label="Account user ID"
              name="userId"
              placeholder="user id"
              size="sm"
            />
            <Input
              aria-label="Suspension reason"
              name="reason"
              placeholder="reason shown to the account"
              size="sm"
            />
          </HStack>
          <HStack gap={2}>
            <Button loading={suspend.isPending} size="xs" type="submit">
              Suspend
            </Button>
            <Button
              loading={restore.isPending}
              onClick={(event) => {
                const form = event.currentTarget.form;
                // SAFETY: the restore button sits in the form that renders
                // <input name="userId">, so its value is a string.
                const userId = trim(
                  (new FormData(form ?? undefined).get("userId") ??
                    "") as string,
                );
                if (userId !== "") {
                  handleRestore(userId);
                }
              }}
              size="xs"
              type="button"
            >
              Restore
            </Button>
          </HStack>
        </Stack>
      </form>
      {feedback && (
        <Alert.Root status={feedback.status}>
          <Alert.Content>
            <Alert.Indicator status={feedback.status} />
            <Alert.Description>{feedback.message}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}
    </Stack>
  );
}
