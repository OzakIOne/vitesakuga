import { Grid, GridItem, VStack } from "@chakra-ui/react";

export function SidebarLayout({
  sidebar,
  content,
}: {
  sidebar: React.ReactNode;
  content: React.ReactNode;
}) {
  return (
    <Grid templateColumns={{ base: "1fr", lg: "1fr 3fr" }} gap={6} w="full">
      <GridItem>
        <VStack gap={4} align="stretch">
          {sidebar}
        </VStack>
      </GridItem>
      <GridItem>
        <VStack gap={4} align="stretch">
          {content}
        </VStack>
      </GridItem>
    </Grid>
  );
}
