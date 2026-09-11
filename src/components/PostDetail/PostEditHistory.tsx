import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmationDialog } from "src/components/ConfirmationDialog";
import { EmptyState } from "src/components/EmptyState";
import { Button } from "src/components/ui/button";
import { Badge } from "src/components/ui/feedback";
import { Box, HStack, Stack } from "src/components/ui/layout";
import { Heading, Text } from "src/components/ui/typography";
import { userHasPermission } from "src/lib/auth/policy";
import { isStaffRole, roleOf } from "src/lib/auth/roles";
import { POST_EDIT_REQUIRED_VOTES } from "src/lib/post-edits/post-edits.config";
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

function EditFields({ entry }: { entry: PostEditHistoryEntry }) {
  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-3 py-2 font-medium" scope="col">
              Field
            </th>
            <th className="px-3 py-2 font-medium" scope="col">
              Before suggestion
            </th>
            <th className="px-3 py-2 font-medium" scope="col">
              Suggested
            </th>
          </tr>
        </thead>
        <tbody>
          {FIELD_KEYS.filter((key) => entry.payload[key] !== undefined).map(
            (key) => (
              <tr
                className="border-t border-gray-200 dark:border-gray-700"
                key={key}
              >
                <th className="px-3 py-2 font-medium" scope="row">
                  {FIELD_LABELS[key]}
                </th>
                <td className="px-3 py-2 break-words text-red-700 dark:text-red-300">
                  {displayValue(entry.previousPayload[key])}
                </td>
                <td className="px-3 py-2 break-words text-green-700 dark:text-green-300">
                  {displayValue(entry.payload[key])}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function HistoryEntry({
  currentUserId,
  entry,
  isPostOwner,
  currentUserRole,
  postId,
}: {
  currentUserId: string | undefined;
  currentUserRole: string | undefined;
  entry: PostEditHistoryEntry;
  isPostOwner: boolean;
  postId: number;
}) {
  const approve = useApprovePostEdit(postId);
  const reject = useRejectPostEdit(postId);
  const [rejectOpen, setRejectOpen] = useState(false);
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
                onClick={() => setRejectOpen(true)}
                size="xs"
                variant="outline"
              >
                Reject
              </Button>
            )}
          </HStack>
        )}
      </HStack>
      <ConfirmationDialog
        confirmLabel="Reject suggestion"
        confirming={reject.isPending}
        description="This rejects the proposed changes and prevents them from being applied to the post."
        onConfirm={() =>
          reject.mutate(entry.id, {
            onSuccess: () => setRejectOpen(false),
          })
        }
        onOpenChange={setRejectOpen}
        open={rejectOpen}
        title="Reject this suggestion?"
      />
      <Box mt={3}>
        <EditFields entry={entry} />
      </Box>
      {entry.status === "pending" && (
        <Text color="gray.500" fontSize="xs" mt={2}>
          {entry.approvals.length}/{POST_EDIT_REQUIRED_VOTES} uploader approvals
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
  return (
    <Box border="1px" borderRadius="md" p={4} shadow="md">
      <Heading as="h2" mb={3}>
        Edit history
      </Heading>
      {history.isPending && <Text color="gray.500">Loading edit history…</Text>}
      {history.isError && <Text>Could not load edit history.</Text>}
      {history.isSuccess && history.data.length === 0 && (
        <EmptyState
          description="Community edit suggestions will appear here."
          title="No edit suggestions yet"
          titleAs="h3"
        />
      )}
      {history.isSuccess && history.data.length > 0 && (
        <Stack align="stretch" gap={3}>
          {history.data.map((entry) => (
            <HistoryEntry
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              entry={entry}
              isPostOwner={isPostOwner}
              key={entry.id}
              postId={postId}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
