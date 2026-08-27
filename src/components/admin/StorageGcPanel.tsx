import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "src/components/ui/button";
import { Spinner } from "src/components/ui/feedback";
import { HStack, Stack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import { previewGc, runGc } from "src/lib/videos/videos.service";

const GC_STALE_MS = 60_000;

/**
 * Admin-only storage maintenance: a dry-run listing expired video revisions
 * (90 days without an open report) and orphaned bucket objects, then an
 * explicit, confirmable sweep.
 */
export function StorageGcPanel() {
  const queryClient = useQueryClient();
  const preview = useQuery({
    queryFn: async ({ signal }) => previewGc({ signal }),
    queryKey: ["moderation", "gc-preview"],
    staleTime: GC_STALE_MS,
  });
  const run = useMutation({
    mutationFn: async () => runGc(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["moderation", "gc-preview"],
      });
    },
  });

  if (preview.isPending) {
    return (
      <Stack align="center" justify="center" minH="200px">
        <Spinner size="lg" />
      </Stack>
    );
  }
  if (preview.isError) {
    return (
      <Text>
        Could not load the storage audit. Only admins can run maintenance.
      </Text>
    );
  }

  const { orphanKeys, purgeableRevisions } = preview.data;
  const totalKeys = orphanKeys.length + purgeableRevisions.length;

  return (
    <Stack gap={4}>
      <Text>
        {purgeableRevisions.length} revision(s) past the retention window and{" "}
        {orphanKeys.length} orphaned object(s) would be removed.
      </Text>

      {purgeableRevisions.length > 0 && (
        <Stack gap={1}>
          <Text fontWeight="bold">Expired revisions</Text>
          {purgeableRevisions.map((revision) => (
            <Text fontSize="sm" key={revision.id}>
              #{revision.id} · post {revision.postId} · {revision.videoKey}
            </Text>
          ))}
        </Stack>
      )}

      {orphanKeys.length > 0 && (
        <Stack gap={1}>
          <Text fontWeight="bold">Orphaned bucket objects</Text>
          {orphanKeys.map((key) => (
            <Text fontSize="sm" key={key}>
              {key}
            </Text>
          ))}
        </Stack>
      )}

      <HStack gap={2}>
        <Button
          disabled={totalKeys === 0 || run.isPending}
          loading={run.isPending}
          onClick={() => run.mutate()}
        >
          Run cleanup
        </Button>
        <Button
          disabled={run.isPending}
          onClick={() => preview.refetch()}
          variant="outline"
        >
          Refresh audit
        </Button>
      </HStack>

      {run.isSuccess && (
        <Text fontSize="sm">
          Cleanup done: {run.data.deletedKeys} object(s) deleted,{" "}
          {run.data.purgedRevisions} revision(s) purged.
        </Text>
      )}
      {run.isError && (
        <Text color="red.500" fontSize="sm">
          Cleanup failed partway — check the server logs and refresh the audit.
        </Text>
      )}
    </Stack>
  );
}
