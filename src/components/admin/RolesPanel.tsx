import { useState } from "react";
import { Button } from "src/components/ui/button";
import { Spinner } from "src/components/ui/feedback";
import { HStack, Stack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import {
  useModerationOverview,
  useSetUserRole,
} from "src/lib/moderation/moderation.hooks";

const ASSIGNABLE_ROLES = ["novice", "uploader", "moderator", "admin"] as const;

/**
 * Admin-only manual rank management: a straight userId → role setter for
 * exceptional cases (corrections, staff onboarding). Normal promotion flow
 * stays with the points queue.
 */
export function RolesPanel() {
  const overview = useModerationOverview();
  const setUserRole = useSetUserRole();
  const [feedback, setFeedback] = useState<string | null>(null);

  if (overview.isPending) {
    return (
      <Stack align="center" justify="center" minH="200px">
        <Spinner size="lg" />
      </Stack>
    );
  }
  if (overview.isError) {
    return <Text>Admin access required.</Text>;
  }

  const handleAssign = (userId: string, role: string) => {
    setFeedback(null);
    setUserRole.mutate(
      { role, userId },
      {
        onError: () => setFeedback(`Could not assign "${role}" to ${userId}.`),
        onSuccess: () => setFeedback(`${userId} is now a ${role}.`),
      },
    );
  };

  return (
    <Stack gap={4}>
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
          <input
            aria-label="User ID"
            name="userId"
            placeholder="user id"
            style={{
              border: "1px solid currentColor",
              borderRadius: 6,
              padding: "4px 8px",
            }}
          />
          <select aria-label="Role" defaultValue="uploader" name="role">
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
      {feedback && <Text fontSize="sm">{feedback}</Text>}
    </Stack>
  );
}
