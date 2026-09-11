import { Portal } from "@ark-ui/react";
import { useState } from "react";
import { LuInfo } from "react-icons/lu";
import { Button } from "src/components/ui/button";
import { Dialog } from "src/components/ui/overlay";
import type { VideoMetadata } from "src/lib/posts/posts.schema";
import { getVideoMetadataRows } from "src/lib/posts/video-metadata";

import { VideoMetadataList } from "./VideoMetadataList";

type VideoMetadataDialogProps = {
  metadata: VideoMetadata | undefined;
};

export function VideoMetadataDialog({ metadata }: VideoMetadataDialogProps) {
  const [open, setOpen] = useState(false);
  const rows = getVideoMetadataRows(metadata);

  return (
    <Dialog.Root onOpenChange={(details) => setOpen(details.open)} open={open}>
      <Button
        disabled={rows.length === 0}
        onClick={() => setOpen(true)}
        size="sm"
        variant="outline"
      >
        <LuInfo aria-hidden style={{ marginRight: "6px" }} />
        Media Info
      </Button>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="md">
            <Dialog.Header>
              <Dialog.Title>Media Info</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <Button aria-label="Close" size="sm" variant="ghost">
                  ×
                </Button>
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Description>
              Technical metadata extracted from the selected video.
            </Dialog.Description>
            <Dialog.Body>
              {metadata && <VideoMetadataList metadata={metadata} />}
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Close</Button>
              </Dialog.ActionTrigger>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
