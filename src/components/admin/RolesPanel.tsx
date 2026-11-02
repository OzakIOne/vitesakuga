import {
  Array as EffectArray,
  Option,
  Schema,
  String as EffectString,
} from "effect";
import { useState } from "react";
import { ListSkeleton } from "src/components/LoadingSkeletons";
import { Button } from "src/components/ui/button";
import { Alert } from "src/components/ui/feedback";
import { Input } from "src/components/ui/field";
import { HStack, Stack } from "src/components/ui/layout";
import { Heading, Text } from "src/components/ui/typography";
import { RoleSchema } from "src/lib/auth/roles";
import {
  useAccountModerationEvents,
  useModerationOverview,
  useSetUserRole,
} from "src/lib/moderation/moderation.hooks";
import type { AccountModerationEvent } from "src/lib/moderation/moderation.service";

const ASSIGNABLE_ROLES = ["novice", "uploader", "moderator", "admin"] as const;

type Feedback = {
  message: string;
  status: "error" | "success";
};

const accountLabel = (
  name: string | null,
  userId: string | null,
  missingLabel: string,
): string => {
  if (name !== null) {
    return `${name} (${userId})`;
  }
  return userId ?? missingLabel;
};

const eventDescription = (event: AccountModerationEvent): string => {
  const target = accountLabel(
    event.targetName,
    event.targetUserId,
    "Unknown account",
  );
  if (event.kind === "role-changed") {
    return `changed ${target}'s role from ${event.previousRole} to ${event.newRole}`;
  }
  if (event.kind === "suspended") {
    return `suspended ${target}`;
  }
  return `restored ${target}`;
};

/**
 * Admin-only manual rank management: a straight userId → role setter for
 * exceptional cases (corrections, staff onboarding). Normal promotion flow
 * stays with the points queue.
 */
export function RolesPanel() {
  const overview = useModerationOverview();
  const accountModerationEvents = useAccountModerationEvents();
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

  const handleAssign = (userId: string, role: string, reason: string) => {
    setFeedback(null);
    const input = reason === "" ? { role, userId } : { reason, role, userId };
    setUserRole.mutate(input, {
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
    });
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
          const parsed = Schema.decodeUnknownOption(
            Schema.Struct({
              reason: Schema.String,
              role: RoleSchema,
              userId: Schema.String,
            }),
          )({
            reason: form.get("reason"),
            role: form.get("role"),
            userId: form.get("userId"),
          });
          Option.match(parsed, {
            onNone: () => undefined,
            onSome: (value) => {
              const userId = EffectString.trim(value.userId);
              if (userId !== "") {
                handleAssign(
                  userId,
                  value.role,
                  EffectString.trim(value.reason),
                );
              }
            },
          });
        }}
      >
        <HStack gap={2}>
          <Input
            aria-label="User ID"
            name="userId"
            placeholder="user id"
            size="sm"
          />
          <Input
            aria-label="Reason (optional)"
            name="reason"
            placeholder="Reason (optional)"
            size="sm"
          />
          <select
            className="border-tone-300 dark:border-tone-600 dark:bg-tone-800 h-8 rounded-md border bg-white px-2 text-sm"
            aria-label="Role"
            defaultValue="uploader"
            name="role"
          >
            {EffectArray.map(ASSIGNABLE_ROLES, (role) => (
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
      <section aria-labelledby="moderation-history-heading">
        <Heading as="h3" id="moderation-history-heading" size="md">
          Recent moderation history
        </Heading>
        {accountModerationEvents.isPending && <ListSkeleton count={2} />}
        {accountModerationEvents.isError && (
          <Text>Could not load moderation history.</Text>
        )}
        {accountModerationEvents.isSuccess &&
          accountModerationEvents.data.length === 0 && (
            <Text>No moderation events yet.</Text>
          )}
        {accountModerationEvents.isSuccess &&
          accountModerationEvents.data.length > 0 && (
            <ul className="mt-2 space-y-2">
              {EffectArray.map(accountModerationEvents.data, (event) => (
                <li
                  className="border-tone-200 dark:border-tone-700 border-t py-2"
                  key={event.id}
                >
                  <p className="text-sm">
                    {accountLabel(
                      event.actorName,
                      event.actorUserId,
                      "Deleted actor",
                    )}{" "}
                    {eventDescription(event)}
                  </p>
                  <p className="text-tone-600 dark:text-tone-300 text-xs">
                    <time dateTime={event.createdAt}>{event.createdAt}</time>
                    {event.reason !== null && ` · ${event.reason}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
      </section>
    </Stack>
  );
}
