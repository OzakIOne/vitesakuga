import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Spinner } from "src/components/ui/feedback";
import { HStack, Stack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import { fetchModerationOverview } from "src/lib/moderation/moderation.service";

/** Recent post reports with links to the flagged posts. */
export function ReportsPanel() {
  const overview = useQuery({
    queryFn: async ({ signal }) => fetchModerationOverview({ signal }),
    queryKey: ["moderation", "overview"],
    staleTime: 15_000,
  });

  if (overview.isPending) {
    return (
      <Stack align="center" justify="center" minH="200px">
        <Spinner size="lg" />
      </Stack>
    );
  }
  if (overview.isError) {
    return <Text>Could not load the report queue.</Text>;
  }

  const reports = overview.data.reports;
  if (reports.length === 0) {
    return <Text>No open reports. 🎉</Text>;
  }

  return (
    <Stack gap={3}>
      {reports.map((report) => (
        <HStack
          border="1px solid"
          borderRadius="md"
          justify="space-between"
          key={`${report.postId}-${report.createdAt.toISOString()}`}
          p={3}
        >
          <Stack gap={0}>
            <Link
              className="link"
              params={{ postId: report.postId }}
              to="/posts/$postId"
            >
              {report.postTitle}
            </Link>
            <Text fontSize="sm">
              Reason:{" "}
              <Text as="span" fontWeight="bold">
                {report.reason}
              </Text>{" "}
              · reported by {report.reporterName}
            </Text>
          </Stack>
          <ButtonRetry postId={report.postId} />
        </HStack>
      ))}
    </Stack>
  );
}

function ButtonRetry({ postId }: { postId: number }) {
  return (
    <Text fontSize="sm">
      Post #{postId} — review the content and act via post tools.
    </Text>
  );
}
