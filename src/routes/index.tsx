import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PopularTagsSection } from "src/components/PopularTagsSection";
import { SearchBox } from "src/components/SearchBox";
import { Box, Flex } from "src/components/ui/layout";
import { Heading } from "src/components/ui/typography";
import { tagsQueryGetPopularTags } from "src/lib/tags/tags.queries";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const popularTags = useSuspenseQuery(tagsQueryGetPopularTags());

  return (
    <Flex
      align="center"
      direction="column"
      justify="center"
      minH="calc(100vh - 4rem)"
      p={4}
    >
      <Heading className="mb-4 text-2xl font-bold">ViteSakuga</Heading>
      <SearchBox placeholder="One piece..." showTitle={false} />
      <Suspense fallback={<Box mt={4}>Loading popular tags...</Box>}>
        <Box maxW="md" mt={4} w="full">
          <PopularTagsSection tags={popularTags.data} />
        </Box>
      </Suspense>
    </Flex>
  );
}
