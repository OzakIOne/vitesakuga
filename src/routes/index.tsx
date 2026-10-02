import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SearchBox } from "src/components/search/SearchBox";
import { PopularTagsSection } from "src/components/tags/PopularTagsSection";
import { Box, Flex } from "src/components/ui/layout";
import { Heading } from "src/components/ui/typography";
import { tagsQueryGetPopularTags } from "src/lib/tags/tags.queries";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: seo({
      description: "Browse and share animation references on ViteSakuga.",
      image: "/android-chrome-512x512.png",
      title: "ViteSakuga — Animation reference archive",
    }),
  }),
});

function Home() {
  const popularTags = useSuspenseQuery(tagsQueryGetPopularTags());

  return (
    <Flex
      align="center"
      direction="column"
      justify="start"
      minH="calc(100vh - 4rem)"
      p={4}
      pt={{ base: 16, md: 24 }}
    >
      <Heading as="h1" mb={6} size="3xl">
        Find the moment you remember.
      </Heading>
      <SearchBox placeholder="One piece..." showTitle={false} />
      <Box maxW="md" mt={4} w="full">
        <PopularTagsSection tags={popularTags.data} />
      </Box>
    </Flex>
  );
}
