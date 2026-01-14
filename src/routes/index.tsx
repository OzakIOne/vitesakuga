import { Box, Flex, Heading } from "@chakra-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PopularTagsSection } from "src/components/PopularTagsSection";
import { SearchBox } from "src/components/SearchBox";
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
      <Heading className="mb-4 font-bold text-2xl">ViteSakuga</Heading>
      <SearchBox placeholder="One piece..." showTitle={false} />
      <Suspense fallback={<Box mt={4}>Loading popular tags...</Box>}>
        <Box maxW="md" mt={4} w={"1/12"}>
          <PopularTagsSection tags={popularTags.data} />
        </Box>
      </Suspense>
    </Flex>
  );
}
