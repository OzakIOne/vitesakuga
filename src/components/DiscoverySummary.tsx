import { Badge } from "src/components/ui/feedback";
import { Box, VStack } from "src/components/ui/layout";
import { Heading, Text } from "src/components/ui/typography";
import {
  DISCOVERY_TRANSPARENCY_NOTE,
  DISCOVERY_VIEW_INFO,
} from "src/lib/posts/discovery";
import type { DiscoveryView } from "src/lib/posts/posts.schema";

export function DiscoverySummary({ view }: { view: DiscoveryView }) {
  if (view === "chronological") return null;

  const info = DISCOVERY_VIEW_INFO[view];
  return (
    <Box border="1px" borderRadius="md" p={4} shadow="sm">
      <VStack align="stretch" gap={2}>
        <Box>
          <Badge colorScheme="blue" mr={2}>
            Opt-in experiment
          </Badge>
          <Heading as="h2" display="inline" size="md">
            {info.label}
          </Heading>
        </Box>
        <Text color="fg.muted" fontSize="sm">
          {info.description}
        </Text>
        <Text fontSize="sm">
          <Text as="span" fontWeight="bold">
            Time window:
          </Text>{" "}
          {info.timeWindow}
          <br />
          <Text as="span" fontWeight="bold">
            Signals:
          </Text>{" "}
          {info.signals}
        </Text>
        <Text color="fg.muted" fontSize="xs">
          {DISCOVERY_TRANSPARENCY_NOTE}
        </Text>
      </VStack>
    </Box>
  );
}
