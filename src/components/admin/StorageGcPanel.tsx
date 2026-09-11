import { Portal } from "@ark-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ListSkeleton } from "src/components/LoadingSkeletons";
import { Button, CloseButton } from "src/components/ui/button";
import { Alert } from "src/components/ui/feedback";
import { HStack, Stack } from "src/components/ui/layout";
import { Dialog } from "src/components/ui/overlay";
import { Text } from "src/components/ui/typography";
import { Heading } from "src/components/ui/typography";
import { previewGc, runGc } from "src/lib/videos/videos.service";

const GC_STALE_MS = 60_000;

/**
 * Admin-only storage maintenance: a dry-run listing expired video revisions
 * (90 days without an open report) and orphaned bucket objects, then an
 * explicit, confirmable sweep.
 */
export function StorageGcPanel() {
  const [confirmOpen, setConfirmOpen] = useState(false);
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
      setConfirmOpen(false);
    },
  });

  if (preview.isPending) {
    return <ListSkeleton count={3} />;
  }
  if (preview.isError) {
    return (
      <Alert.Root status="error">
        <Alert.Content>
          <Alert.Indicator status="error" />
          <Alert.Description>
            Could not load the storage audit. Only admins can run maintenance.
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  const { orphanKeys, purgeableRevisions } = preview.data;
  const totalKeys = orphanKeys.length + purgeableRevisions.length;

  return (
    <Stack gap={4}>
      <Heading as="h2" size="lg">
        Storage cleanup
      </Heading>
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
          onClick={() => setConfirmOpen(true)}
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
        <Alert.Root status="success">
          <Alert.Content>
            <Alert.Indicator status="success" />
            <div>
              <Alert.Title>Cleanup complete</Alert.Title>
              <Alert.Description>
                {run.data.deletedKeys} object(s) deleted and{" "}
                {run.data.purgedRevisions} revision(s) purged.
              </Alert.Description>
            </div>
          </Alert.Content>
        </Alert.Root>
      )}
      {run.isError && (
        <Alert.Root status="error">
          <Alert.Content>
            <Alert.Indicator status="error" />
            <div>
              <Alert.Title>Cleanup failed</Alert.Title>
              <Alert.Description>
                Cleanup failed partway. Check the server logs and refresh the
                audit before retrying.
              </Alert.Description>
            </div>
          </Alert.Content>
        </Alert.Root>
      )}

      <Dialog.Root
        onOpenChange={(details) => setConfirmOpen(details.open)}
        open={confirmOpen}
        role="alertdialog"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="md">
              <Dialog.Header>
                <Dialog.Title>Run storage cleanup?</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body>
                <Dialog.Description>
                  This permanently deletes {orphanKeys.length} orphaned
                  object(s) and purges {purgeableRevisions.length} expired
                  revision(s). This action cannot be undone.
                </Dialog.Description>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.ActionTrigger>
                <Button
                  colorPalette="red"
                  loading={run.isPending}
                  onClick={() => run.mutate()}
                >
                  Delete {totalKeys} object(s)
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Stack>
  );
}
