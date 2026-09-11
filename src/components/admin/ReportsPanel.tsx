import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { EmptyState } from "src/components/EmptyState";
import { ListSkeleton } from "src/components/LoadingSkeletons";
import { Button } from "src/components/ui/button";
import { Alert } from "src/components/ui/feedback";
import { HStack, Stack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import { Heading } from "src/components/ui/typography";
import { REPORT_REASON_LABELS } from "src/lib/db/schema/sakuga.utils";
import { fetchModerationOverview } from "src/lib/moderation/moderation.service";

const reportReasonLabel = (reason: string): string => {
  switch (reason) {
    case "duplicate":
      return REPORT_REASON_LABELS.duplicate;
    case "poor_quality":
      return REPORT_REASON_LABELS.poor_quality;
    case "unrelated":
      return REPORT_REASON_LABELS.unrelated;
    default:
      return reason;
  }
};

/** Recent post reports with links to the flagged posts. */
export function ReportsPanel() {
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
          <div>
            <Alert.Title>Could not load reports</Alert.Title>
            <Alert.Description>
              Refresh the queue and try again.
            </Alert.Description>
            <Button
              className="mt-3"
              onClick={() => void overview.refetch()}
              size="sm"
            >
              Retry
            </Button>
          </div>
        </Alert.Content>
      </Alert.Root>
    );
  }

  const reports = overview.data.reports;
  if (reports.length === 0) {
    return (
      <EmptyState
        description="The moderation queue is clear."
        title="No open reports"
      />
    );
  }

  return (
    <Stack gap={3}>
      <Heading as="h2" size="lg">
        Open reports
      </Heading>
      {reports.map((report) => (
        <HStack
          border="1px solid"
          borderRadius="md"
          justify="space-between"
          key={`${report.postId}-${String(report.createdAt)}`}
          p={3}
        >
          <Stack gap={0}>
            <Link
              className="link"
              params={{ postId: String(report.postId) }}
              to="/posts/$postId"
            >
              {report.postTitle}
            </Link>
            <Text fontSize="sm">
              Reason:{" "}
              <Text as="span" fontWeight="bold">
                {reportReasonLabel(report.reason)}
              </Text>{" "}
              · reported by {report.reporterName}
            </Text>
          </Stack>
          <Button asChild size="xs" variant="outline">
            <Link
              params={{ postId: String(report.postId) }}
              to="/posts/$postId"
            >
              Review post
            </Link>
          </Button>
        </HStack>
      ))}
    </Stack>
  );
}
