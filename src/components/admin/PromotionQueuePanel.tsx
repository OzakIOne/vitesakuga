import { useQuery } from "@tanstack/react-query";
import { Button } from "src/components/ui/button";
import { Spinner } from "src/components/ui/feedback";
import { Stack, HStack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
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
  const approve = useApprovePromotion();
  const reject = useRejectPromotion();

  if (queue.isPending) {
    return (
      <Stack align="center" justify="center" minH="200px">
        <Spinner size="lg" />
      </Stack>
    );
  }
  if (queue.isError) {
    return <Text>Could not load the promotion queue.</Text>;
  }

  const candidates = queue.data ?? [];
  if (candidates.length === 0) {
    return (
      <Text>
        No candidates are waiting. Thresholds: {PROMOTION_RULES.minPoints}{" "}
        points and a {PROMOTION_RULES.minAccountAgeDays}-day-old account.
      </Text>
    );
  }

  return (
    <Stack gap={4}>
      {candidates.map((candidate) => (
        <HStack
          border="1px solid"
          borderRadius="md"
          gap={4}
          justify="space-between"
          key={candidate.userId}
          p={3}
        >
          <Stack gap={0}>
            <Text fontWeight="bold">{candidate.name}</Text>
            <Text fontSize="sm">
              {candidate.totalPoints} pts · {candidate.activity.uploads} uploads
              · {candidate.activity.likesReceived} likes received ·{" "}
              {candidate.activity.comments} comments received
            </Text>
          </Stack>
          <HStack gap={2}>
            <Button
              disabled={approve.isPending || reject.isPending}
              loading={approve.isPending}
              onClick={() => approve.mutate(candidate.userId)}
              size="xs"
            >
              Promote
            </Button>
            <Button
              disabled={approve.isPending || reject.isPending}
              onClick={() => reject.mutate(candidate.userId)}
              size="xs"
              variant="outline"
            >
              Reject
            </Button>
          </HStack>
        </HStack>
      ))}
    </Stack>
  );
}
