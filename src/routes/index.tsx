import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PopularTagsSection } from "src/components/PopularTagsSection";
import { SearchBox } from "src/components/SearchBox";
import { Button } from "src/components/ui/button";
import { Box, Flex } from "src/components/ui/layout";
import { Heading, Text } from "src/components/ui/typography";
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
      <Text className="mb-3 text-sm font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-400">
        The animation reference archive
      </Text>
      <Heading
        as="h1"
        className="text-center text-4xl font-bold tracking-tight sm:text-5xl"
        size="2xl"
      >
        Find the moment you remember.
      </Heading>
      <Text className="mt-4 max-w-xl text-center text-lg text-gray-600 dark:text-gray-400">
        Search, share, and curate animation cuts with a community of artists and
        fans.
      </Text>
      <SearchBox placeholder="One piece..." showTitle={false} />
      <Box maxW="md" mt={4} w="full">
        <PopularTagsSection tags={popularTags.data} />
      </Box>
      <Button asChild className="mt-8" colorPalette="blue" size="lg">
        <Link to="/random">
          Show me a random post <span aria-hidden="true">→</span>
        </Link>
      </Button>
      <Link
        className="mt-8 text-sm text-blue-600 hover:underline dark:text-blue-400"
        to="/news"
      >
        What’s new on ViteSakuga <span aria-hidden="true">→</span>
      </Link>
    </Flex>
  );
}
