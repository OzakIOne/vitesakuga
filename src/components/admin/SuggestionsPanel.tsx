import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "src/components/ui/button";
import { Spinner } from "src/components/ui/feedback";
import { HStack, Stack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import {
  useApproveEdit,
  useRejectEdit,
} from "src/lib/moderation/moderation.hooks";
import { fetchModerationOverview } from "src/lib/moderation/moderation.service";
import type { ModerationPendingEditRow } from "src/lib/moderation/moderation.service";

const REQUIRED_VOTES = 2;

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
  const approve = useApproveEdit();
  const reject = useRejectEdit();

  if (overview.isPending) {
    return (
      <Stack align="center" justify="center" minH="200px">
        <Spinner size="lg" />
      </Stack>
    );
  }
  if (overview.isError) {
    return <Text>Could not load pending suggestions.</Text>;
  }

  const suggestions = overview.data.pendingEdits;
  if (suggestions.length === 0) {
    return <Text>No pending edit suggestions.</Text>;
  }

  return (
    <Stack gap={3}>
      {suggestions.map((suggestion) => (
        <SuggestionRow
          approve={approve}
          key={suggestion.editId}
          reject={reject}
          suggestion={suggestion}
        />
      ))}
    </Stack>
  );
}

function SuggestionRow({
  approve,
  reject,
  suggestion,
}: {
  readonly approve: ReturnType<typeof useApproveEdit>;
  readonly reject: ReturnType<typeof useRejectEdit>;
  readonly suggestion: ModerationPendingEditRow;
}) {
  const busy = approve.isPending || reject.isPending;
  return (
    <HStack border="1px solid" borderRadius="md" justify="space-between" p={3}>
      <Stack gap={0}>
        <Link
          className="link"
          params={{ postId: suggestion.postId }}
          to="/posts/$postId"
        >
          {suggestion.postTitle}
        </Link>
        <Text fontSize="sm">
          by {suggestion.suggestedByName} · {suggestion.approvals}/
          {REQUIRED_VOTES} peer votes
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
          onClick={() => reject.mutate(suggestion.editId)}
          size="xs"
          variant="outline"
        >
          Discard
        </Button>
      </HStack>
    </HStack>
  );
}
