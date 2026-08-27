import { Portal } from "@ark-ui/react";
import { useState } from "react";
import { Button } from "src/components/ui/button";
import { VStack } from "src/components/ui/layout";
import { Dialog } from "src/components/ui/overlay";
import { Text } from "src/components/ui/typography";
import type { PostReportReason } from "src/lib/db/schema";
import { REPORT_REASON_LABELS } from "src/lib/db/schema";
import { useSubmitReport } from "src/lib/reports/reports.hooks";

type ReportDialogProps = {
  onCancel: () => void;
  postId: number;
};

// SAFETY: REPORT_REASON_LABELS is contract-checked with `satisfies` against
// Record<PostReportReason, string>, so its keys are exactly the reason union.
const REPORT_REASONS = Object.keys(REPORT_REASON_LABELS) as PostReportReason[];

export function ReportDialog({ onCancel, postId }: ReportDialogProps) {
  const [reason, setReason] = useState<PostReportReason | null>(null);
  const submitReport = useSubmitReport(postId);

  const handleSubmit = () => {
    if (!reason || submitReport.isPending) return;
    submitReport.mutate(reason, { onSuccess: onCancel });
  };

  return (
    <Dialog.Root
      defaultOpen
      onEscapeKeyDown={onCancel}
      onInteractOutside={onCancel}
      onOpenChange={(e) => {
        if (!e.open) onCancel();
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="sm">
            <Dialog.Header>
              <Dialog.Title>Report this post</Dialog.Title>
              <Dialog.CloseTrigger onClick={onCancel} />
            </Dialog.Header>

            <Dialog.Body>
              <VStack align="stretch" gap={2}>
                <Text color="gray.500" fontSize="sm">
                  Why are you reporting this post?
                </Text>
                <fieldset className="flex flex-col gap-2">
                  <legend className="sr-only">Report reason</legend>
                  {REPORT_REASONS.map((value) => (
                    <label
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                      key={value}
                    >
                      <input
                        checked={reason === value}
                        className="accent-blue-600"
                        name="report-reason"
                        onChange={() => setReason(value)}
                        type="radio"
                        value={value}
                      />
                      {REPORT_REASON_LABELS[value]}
                    </label>
                  ))}
                </fieldset>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <Button
                disabled={!reason || submitReport.isPending}
                loading={submitReport.isPending}
                onClick={handleSubmit}
                size="sm"
              >
                Submit report
              </Button>
              <Button onClick={onCancel} size="sm" variant="ghost">
                Cancel
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
