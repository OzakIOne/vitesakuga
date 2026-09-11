import { useState } from "react";
import { ListSkeleton } from "src/components/LoadingSkeletons";
import { Button } from "src/components/ui/button";
import { Alert } from "src/components/ui/feedback";
import { Input } from "src/components/ui/field";
import { HStack, Stack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import { Heading } from "src/components/ui/typography";
import {
  useModerationOverview,
  useSetUserRole,
} from "src/lib/moderation/moderation.hooks";

const ASSIGNABLE_ROLES = ["novice", "uploader", "moderator", "admin"] as const;

type Feedback = {
  message: string;
  status: "error" | "success";
};

/**
 * Admin-only manual rank management: a straight userId → role setter for
 * exceptional cases (corrections, staff onboarding). Normal promotion flow
 * stays with the points queue.
 */
export function RolesPanel() {
  const overview = useModerationOverview();
  const setUserRole = useSetUserRole();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  if (overview.isPending) {
    return <ListSkeleton count={2} />;
  }
  if (overview.isError) {
    return (
      <Alert.Root status="error">
        <Alert.Content>
          <Alert.Indicator status="error" />
          <Alert.Description>
            Could not load role management. Admin access is required.
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  const handleAssign = (userId: string, role: string) => {
    setFeedback(null);
    setUserRole.mutate(
      { role, userId },
      {
        onError: () =>
          setFeedback({
            message: `Could not assign "${role}" to ${userId}.`,
            status: "error",
          }),
        onSuccess: () =>
          setFeedback({
            message: `${userId} is now a ${role}.`,
            status: "success",
          }),
      },
    );
  };

  return (
    <Stack gap={4}>
      <Heading as="h2" size="lg">
        Manage roles
      </Heading>
      <Text>
        Manual rank assignment for special cases. Regular promotions go through
        the points queue above.
      </Text>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          // SAFETY: the form renders the <input name="userId">; FormData.get
          // returns its string value, and the non-empty check below guards
          // empty input.
          const userId = ((form.get("userId") ?? "") as string).trim();
          // SAFETY: the form renders the <select name="role">; FormData.get
          // returns its string value.
          const role = (form.get("role") ?? "") as string;
          if (userId !== "" && role !== "") {
            handleAssign(userId, role);
          }
        }}
      >
        <HStack gap={2}>
          <Input
            aria-label="User ID"
            name="userId"
            placeholder="user id"
            size="sm"
          />
          <select
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            aria-label="Role"
            defaultValue="uploader"
            name="role"
          >
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <Button loading={setUserRole.isPending} size="xs" type="submit">
            Assign
          </Button>
        </HStack>
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
