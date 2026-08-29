import { Portal } from "@ark-ui/react";
import { useState } from "react";
import { LuInfo } from "react-icons/lu";
import { Button } from "src/components/ui/button";
import { DataList } from "src/components/ui/feedback";
import { Box } from "src/components/ui/layout";
import { Dialog, Popover } from "src/components/ui/overlay";
import { Text } from "src/components/ui/typography";
import type { VideoMetadata } from "src/lib/posts/posts.schema";

type VideoMetadataDialogProps = {
  metadata: VideoMetadata | undefined;
};

const ENCODED_LIBRARY_SETTINGS_KEY = "Encoded_Library_Settings";

export function VideoMetadataDialog({ metadata }: VideoMetadataDialogProps) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(metadata ?? {});

  return (
    <Dialog.Root onOpenChange={(details) => setOpen(details.open)} open={open}>
      <Button
        disabled={entries.length === 0}
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
              <DataList.Root orientation="horizontal">
                {entries.map(([key, value]) => (
                  <DataList.Item key={key}>
                    <DataList.ItemLabel>{key}</DataList.ItemLabel>
                    <DataList.ItemValue>
                      {key === ENCODED_LIBRARY_SETTINGS_KEY ? (
                        <Popover.Root>
                          <Popover.Trigger asChild>
                            <Button size="xs" variant="outline">
                              View Settings
                            </Button>
                          </Popover.Trigger>
                          <Portal>
                            <Popover.Positioner>
                              <Popover.Content maxW="sm">
                                <Popover.Arrow />
                                <Popover.Body>
                                  <Text className="max-h-48 overflow-y-auto break-words whitespace-pre-wrap">
                                    {value}
                                  </Text>
                                </Popover.Body>
                              </Popover.Content>
                            </Popover.Positioner>
                          </Portal>
                        </Popover.Root>
                      ) : (
                        String(value)
                      )}
                    </DataList.ItemValue>
                  </DataList.Item>
                ))}
              </DataList.Root>
              {entries.length === 0 && (
                <Box color="gray.500" fontSize="sm">
                  No metadata available for this file.
                </Box>
              )}
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
