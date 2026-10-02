import { createLazyFileRoute } from "@tanstack/react-router";
import { Container } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import { ConvertPage } from "src/features/convert/convert-page";

export const Route = createLazyFileRoute("/convert")({
  component: ConvertPage,
  pendingComponent: () => (
    <Container maxW="xl" py={8}>
      <Text>Loading converter…</Text>
    </Container>
  ),
});
