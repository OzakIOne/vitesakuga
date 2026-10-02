import { createLazyFileRoute } from "@tanstack/react-router";
import { Box } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import { UploadPage } from "src/features/upload/upload-page";

export const Route = createLazyFileRoute("/upload")({
  component: UploadPage,
  pendingComponent: () => (
    <Box maxW="xl" mx="auto" px={4} py={8}>
      <Text>Loading upload form...</Text>
    </Box>
  ),
});
