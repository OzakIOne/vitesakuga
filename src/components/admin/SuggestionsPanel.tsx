import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ConfirmationDialog } from "src/components/ConfirmationDialog";
import { EmptyState } from "src/components/EmptyState";
import { ListSkeleton } from "src/components/LoadingSkeletons";
import { Button } from "src/components/ui/button";
import { Alert } from "src/components/ui/feedback";
import { HStack, Stack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import { Heading } from "src/components/ui/typography";
import {
  useApproveEdit,
  useRejectEdit,
} from "src/lib/moderation/moderation.hooks";
import { fetchModerationOverview } from "src/lib/moderation/moderation.service";
import type { ModerationPendingEditRow } from "src/lib/moderation/moderation.service";
import { POST_EDIT_REQUIRED_VOTES } from "src/lib/post-edits/post-edits.config";

/**
 * Wiki-style edit suggestions awaiting peer votes or a staff decision.
 * Staff can apply (or discard) each one directly.
 */
export function SuggestionsPanel() {
  const overview = useQuery({
    queryFn: async ({ signal }) => fetchModerationOverview({ signal }),
    queryKey: ["moderation", "overview"],
    staleTime: 15_000,
  });
  if (overview.isPending) {
    return <ListSkeleton count={3} />;
  }
  if (overview.isError) {
    return (
      <Alert.Root status="error">
        <Alert.Content>
          <Alert.Indicator status="error" />
          <Alert.Description>
            Could not load pending suggestions. Refresh and try again.
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  const suggestions = overview.data.pendingEdits;
  if (suggestions.length === 0) {
    return (
      <EmptyState
        description="Community edit suggestions will appear here for review."
        title="No pending edit suggestions"
      />
    );
  }

  return (
    <Stack gap={3}>
      <Heading as="h2" size="lg">
        Pending edit suggestions
      </Heading>
      {suggestions.map((suggestion) => (
        <SuggestionRow key={suggestion.editId} suggestion={suggestion} />
      ))}
    </Stack>
  );
}

function SuggestionRow({
  suggestion,
}: {
  readonly suggestion: ModerationPendingEditRow;
}) {
  const approve = useApproveEdit();
  const reject = useRejectEdit();
  const [discardOpen, setDiscardOpen] = useState(false);
  const busy = approve.isPending || reject.isPending;
  return (
    <HStack border="1px solid" borderRadius="md" justify="space-between" p={3}>
      <Stack gap={0}>
        <Link
          className="link"
          params={{ postId: String(suggestion.postId) }}
          to="/posts/$postId"
        >
          {suggestion.postTitle}
        </Link>
        <Text fontSize="sm">
          by {suggestion.suggestedByName} · {suggestion.approvals}/
          {POST_EDIT_REQUIRED_VOTES} peer votes
        </Text>
      </Stack>
      <HStack gap={2}>
        <Button
          disabled={busy}
          loading={approve.isPending}
          onClick={() => approve.mutate(suggestion.editId)}
          size="xs"
        >
          Apply
        </Button>
        <Button
          disabled={busy}
          onClick={() => setDiscardOpen(true)}
          size="xs"
          variant="outline"
        >
          Discard
        </Button>
      </HStack>
      <ConfirmationDialog
        confirmLabel="Discard suggestion"
        confirming={reject.isPending}
        description="This rejects the proposed changes and removes them from the pending moderation queue."
        onConfirm={() =>
          reject.mutate(suggestion.editId, {
            onSuccess: () => setDiscardOpen(false),
          })
        }
        onOpenChange={setDiscardOpen}
        open={discardOpen}
        title="Discard this suggestion?"
      />
    </HStack>
  );
}
