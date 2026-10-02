import { Portal } from "@ark-ui/react";
import { Button } from "src/components/ui/button";
import { DataList } from "src/components/ui/feedback";
import { Popover } from "src/components/ui/overlay";
import { Text } from "src/components/ui/typography";
import type { VideoMetadata } from "src/lib/posts/posts.schema";
import { getVideoMetadataRows } from "src/lib/posts/video-metadata";

export function VideoMetadataList({ metadata }: { metadata: VideoMetadata }) {
  return (
    <DataList.Root orientation="horizontal">
      {getVideoMetadataRows(metadata).map((row) => (
        <DataList.Item key={row.key}>
          <DataList.ItemLabel>{row.label}</DataList.ItemLabel>
          <DataList.ItemValue>
            {row.settings ? (
              <Popover.Root>
                <Popover.Trigger asChild>
                  <Button size="xs" variant="outline">
                    View settings
                  </Button>
                </Popover.Trigger>
                <Portal>
                  <Popover.Positioner>
                    <Popover.Content maxW="sm">
                      <Popover.Arrow />
                      <Popover.Body>
                        <Text className="max-h-48 overflow-y-auto break-words whitespace-pre-wrap">
                          {row.settings}
                        </Text>
                      </Popover.Body>
                    </Popover.Content>
                  </Popover.Positioner>
                </Portal>
              </Popover.Root>
            ) : (
              row.value
            )}
          </DataList.ItemValue>
        </DataList.Item>
      ))}
    </DataList.Root>
  );
}
