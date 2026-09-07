import { useQuery } from "@tanstack/react-query";
import { Button } from "src/components/ui/button";
import { Badge } from "src/components/ui/feedback";
import { Box, HStack, Stack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import { userHasPermission } from "src/lib/auth/policy";
import { isStaffRole, roleOf } from "src/lib/auth/roles";
import {
  useApprovePostEdit,
  useRejectPostEdit,
} from "src/lib/post-edits/post-edits.hooks";
import { postEditsQuery } from "src/lib/post-edits/post-edits.queries";
import type { PostEditHistoryEntry } from "src/lib/post-edits/post-edits.service";
import { formatDateUtc } from "src/utils/date-format";

import { FIELD_KEYS, FIELD_LABELS } from "./PostEditSuggestionDialog";

type PostEditHistoryProps = {
  currentUserId?: string | undefined;
  currentUserRole?: string | undefined;
  isPostOwner: boolean;
  postId: number;
};

const statusLabels = {
  approved: "Applied",
  pending: "Pending",
  rejected: "Rejected",
} as const;

const statusColors = {
  approved: "green",
  pending: "orange",
  rejected: "red",
} as const;

const displayValue = (
  value: PostEditHistoryEntry["payload"][keyof PostEditHistoryEntry["payload"]],
): string =>
  value === null || value === undefined || value === ""
    ? "Empty"
    : String(value);

function EditFields({ payload }: { payload: PostEditHistoryEntry["payload"] }) {
  return (
    <Stack align="stretch" gap={1}>
      {FIELD_KEYS.filter((key) => payload[key] !== undefined).map((key) => (
        <HStack align="start" gap={2} key={key}>
          <Text fontWeight="medium" minW="6rem">
            {FIELD_LABELS[key]}
          </Text>
          <Text className="break-words text-green-700 dark:text-green-300">
            {displayValue(payload[key])}
          </Text>
        </HStack>
      ))}
    </Stack>
  );
}

function HistoryEntry({
  currentUserId,
  entry,
  isPostOwner,
  currentUserRole,
  approve,
  reject,
}: {
  currentUserId: string | undefined;
  currentUserRole: string | undefined;
  entry: PostEditHistoryEntry;
  isPostOwner: boolean;
  approve: ReturnType<typeof useApprovePostEdit>;
  reject: ReturnType<typeof useRejectPostEdit>;
}) {
  const role = roleOf({ id: currentUserId, role: currentUserRole });
  const isStaff = isStaffRole(role);
  const isEligibleContributor =
    isStaff || isPostOwner || userHasPermission(role, "posts:suggest-edit");
  const canDecide =
    entry.status === "pending" &&
    currentUserId !== undefined &&
    currentUserId !== entry.suggestedBy &&
    isEligibleContributor;
  const canReject = canDecide && (isStaff || isPostOwner);
  const busy = approve.isPending || reject.isPending;

  return (
    <Box border="1px solid" borderRadius="md" p={3}>
      <HStack align="start" justify="space-between">
        <Stack align="start" gap={1}>
          <HStack gap={2}>
            <Badge colorPalette={statusColors[entry.status]}>
              {statusLabels[entry.status]}
            </Badge>
            <Text fontSize="sm" fontWeight="medium">
              {entry.suggestedByName}
            </Text>
          </HStack>
          <Text color="gray.500" fontSize="xs">
            {formatDateUtc(entry.createdAt)}
            {entry.resolvedByName
              ? ` · decided by ${entry.resolvedByName}`
              : ""}
          </Text>
        </Stack>
        {canDecide && (
          <HStack gap={2}>
            <Button
              disabled={busy}
              loading={approve.isPending}
              onClick={() => approve.mutate(entry.id)}
              size="xs"
            >
              Approve
            </Button>
            {canReject && (
              <Button
                disabled={busy}
                loading={reject.isPending}
                onClick={() => reject.mutate(entry.id)}
                size="xs"
                variant="outline"
              >
                Reject
              </Button>
            )}
          </HStack>
        )}
      </HStack>
      <Box mt={3}>
        <EditFields payload={entry.payload} />
      </Box>
      {entry.status === "pending" && (
        <Text color="gray.500" fontSize="xs" mt={2}>
          {entry.approvals.length}/2 uploader approvals
        </Text>
      )}
    </Box>
  );
}

export function PostEditHistory({
  currentUserId,
  currentUserRole,
  isPostOwner,
  postId,
}: PostEditHistoryProps) {
  const history = useQuery(postEditsQuery(postId));
  const approve = useApprovePostEdit(postId);
  const reject = useRejectPostEdit(postId);

  return (
    <Box border="1px" borderRadius="md" p={4} shadow="md">
      <Text fontSize="xl" fontWeight="bold" mb={3}>
        Edit history
      </Text>
      {history.isPending && <Text color="gray.500">Loading edit history…</Text>}
      {history.isError && <Text>Could not load edit history.</Text>}
      {history.isSuccess && history.data.length === 0 && (
        <Text color="gray.500">No community edit suggestions yet.</Text>
      )}
      {history.isSuccess && history.data.length > 0 && (
        <Stack align="stretch" gap={3}>
          {history.data.map((entry) => (
            <HistoryEntry
              approve={approve}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              entry={entry}
              isPostOwner={isPostOwner}
              key={entry.id}
              reject={reject}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
