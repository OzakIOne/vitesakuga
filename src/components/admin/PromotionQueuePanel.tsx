import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmationDialog } from "src/components/ConfirmationDialog";
import { EmptyState } from "src/components/EmptyState";
import { ListSkeleton } from "src/components/LoadingSkeletons";
import { Button } from "src/components/ui/button";
import { Alert } from "src/components/ui/feedback";
import { Stack, HStack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import { Heading } from "src/components/ui/typography";
import {
  useApprovePromotion,
  useRejectPromotion,
} from "src/lib/moderation/moderation.hooks";
import { PROMOTION_RULES } from "src/lib/promotions/promotions.config";
import { fetchPromotionQueue } from "src/lib/promotions/promotions.service";

/**
 * Novices who crossed the points + account-age thresholds and are awaiting
 * a staff decision. Approving promotes to uploader; rejecting hides them
 * until they out-earn the rejection snapshot.
 */
export function PromotionQueuePanel() {
  const queue = useQuery({
    queryFn: async ({ signal }) => fetchPromotionQueue({ signal }),
    queryKey: ["moderation", "promotion-queue"],
    staleTime: 15_000,
  });
  if (queue.isPending) {
    return <ListSkeleton count={3} />;
  }
  if (queue.isError) {
    return (
      <Alert.Root status="error">
        <Alert.Content>
          <Alert.Indicator status="error" />
          <Alert.Description>
            Could not load the promotion queue. Refresh and try again.
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  const candidates = queue.data ?? [];
  if (candidates.length === 0) {
    return (
      <EmptyState
        description={`Thresholds: ${PROMOTION_RULES.minPoints} points and a ${PROMOTION_RULES.minAccountAgeDays}-day-old account.`}
        title="No candidates are waiting"
      />
    );
  }

  return (
    <Stack gap={4}>
      <Heading as="h2" size="lg">
        Promotion queue
      </Heading>
      {candidates.map((candidate) => (
        <PromotionCandidateRow candidate={candidate} key={candidate.userId} />
      ))}
    </Stack>
  );
}

function PromotionCandidateRow({
  candidate,
}: {
  candidate: Awaited<ReturnType<typeof fetchPromotionQueue>>[number];
}) {
  const approve = useApprovePromotion();
  const reject = useRejectPromotion();
  const [rejectOpen, setRejectOpen] = useState(false);
  const busy = approve.isPending || reject.isPending;

  return (
    <HStack
      border="1px solid"
      borderRadius="md"
      gap={4}
      justify="space-between"
      p={3}
    >
      <Stack gap={0}>
        <Text fontWeight="bold">{candidate.name}</Text>
        <Text fontSize="sm">
          {candidate.totalPoints} pts · {candidate.activity.uploads} uploads ·{" "}
          {candidate.activity.likesReceived} likes received ·{" "}
          {candidate.activity.comments} comments received
        </Text>
      </Stack>
      <HStack gap={2}>
        <Button
          disabled={busy}
          loading={approve.isPending}
          onClick={() => approve.mutate(candidate.userId)}
          size="xs"
        >
          Promote
        </Button>
        <Button
          disabled={busy}
          loading={reject.isPending}
          onClick={() => setRejectOpen(true)}
          size="xs"
          variant="outline"
        >
          Reject
        </Button>
      </HStack>
      <ConfirmationDialog
        confirmLabel="Reject promotion"
        confirming={reject.isPending}
        description={`${candidate.name} will remain a novice and leave this queue until they earn more activity points.`}
        onConfirm={() =>
          reject.mutate(candidate.userId, {
            onSuccess: () => setRejectOpen(false),
          })
        }
        onOpenChange={setRejectOpen}
        open={rejectOpen}
        title="Reject this promotion?"
      />
    </HStack>
  );
}
