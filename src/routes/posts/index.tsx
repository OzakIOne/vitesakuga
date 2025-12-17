import { Box, GridItem, Spinner, Stack, Text, VStack } from "@chakra-ui/react";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useMemo } from "react";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { VirtualizedPostList } from "src/components/VirtualizedPostList";
import { envClient } from "src/lib/env/client";
import { postsInfiniteQueryOptions } from "src/lib/posts/posts.queries";
import { postSearchSchema } from "src/lib/posts/posts.schema";
import { filterAndSortPosts } from "src/lib/posts/posts.utils";

export const Route = createFileRoute("/posts/")({
  component: PostsLayoutComponent,
  // fix initial window is not defined error
  ssr: "data-only",
  validateSearch: postSearchSchema,
});

function PostsContent() {
  const { q, tags, size, sortBy, dateRange } = Route.useSearch();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSuspenseInfiniteQuery(postsInfiniteQueryOptions(q, tags));

  const allPosts = data?.pages?.flatMap((page) => page.data) ?? [];
  const popularTags = data?.pages?.[0]?.meta?.popularTags ?? [];

  const filteredPosts = useMemo(() => {
    return filterAndSortPosts(allPosts, {
      dateRange,
      sortBy,
    });
  }, [allPosts, sortBy, dateRange]);

  return (
    <Box p={4} w="full">
      {envClient.MODE === "development" && (
        <VStack align="start" borderBottom="1px" p={4}>
          <Text fontSize="sm">Posts loaded: {allPosts.length}</Text>
          <Text fontSize="sm">Filtered posts: {filteredPosts.length}</Text>
          <Text fontSize="sm">Has next page: {hasNextPage ? "Yes" : "No"}</Text>
          <Text fontSize="sm">
            Last cursor:{" "}
            {data?.pages?.[data.pages.length - 1]?.meta?.cursors?.after ||
              "N/A"}
          </Text>
        </VStack>
      )}
      <PostsPageLayout
        dateRange={dateRange}
        fromRoute="/posts"
        popularTags={popularTags}
        searchQuery={q}
        selectedTags={tags}
        sortBy={sortBy}
      >
        <GridItem>
          <Suspense
            fallback={
              <Stack align="center" justify="center" minH="600px">
                <Spinner size="lg" />
                <Text>Loading posts...</Text>
              </Stack>
            }
          >
            <VirtualizedPostList
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onFetchNextPage={fetchNextPage}
              pageSize={size}
              posts={filteredPosts}
              searchQuery={q}
            />
          </Suspense>
        </GridItem>
      </PostsPageLayout>
    </Box>
  );
}

function PostsLayoutComponent() {
  return <PostsContent />;
}
