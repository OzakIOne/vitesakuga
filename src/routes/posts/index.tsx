import { createFileRoute } from "@tanstack/react-router";
import { Pagination } from "src/components/Pagination";
import { PostCard } from "src/components/PostCard";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { Spinner } from "src/components/ui/feedback";
import {
  Box,
  GridItem,
  SimpleGrid,
  Stack,
  VStack,
} from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import { toStandardSchemaV1Strict } from "src/lib/effect/schema.utils";
import { envClient } from "src/lib/env/client";
import { usePostsPage } from "src/lib/posts/posts.hooks";
import { postsQueryOptions } from "src/lib/posts/posts.queries";
import { searchPostsBaseSchema } from "src/lib/posts/posts.schema";

export const Route = createFileRoute("/posts/")({
  component: PostsContent,
  validateSearch: toStandardSchemaV1Strict(searchPostsBaseSchema),
  ssr: "data-only",
});

function PostsContent() {
  const searchParams = Route.useSearch();
  const { q, tags, sortBy, dateRange, page } = searchParams;

  const { posts, popularTags, totalPages, handlePageChange, isFetching } =
    usePostsPage(postsQueryOptions(searchParams));

  return (
    <Box p={4} w="full">
      {envClient.MODE === "development" && (
        <VStack align="start" borderBottom="1px" mb={4} p={4}>
          <Text fontSize="sm">Posts loaded: {posts.length}</Text>
          <Text fontSize="sm">Total pages: {totalPages}</Text>
          <Text fontSize="sm">Current page: {page}</Text>
          <Text fontSize="sm">Total pages: {totalPages}</Text>
        </VStack>
      )}
      <PostsPageLayout
        dateRange={dateRange}
        fromRoute="/posts/"
        popularTags={popularTags}
        searchQuery={q}
        selectedTags={tags}
        sortBy={sortBy}
      >
        <GridItem>
          {isFetching && (
            <Stack align="center" justify="center" pb={2}>
              <Spinner size="sm" />
            </Stack>
          )}
          {posts.length === 0 ? (
            <Box
              alignItems="center"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="md"
              display="flex"
              h="400px"
              justifyContent="center"
            >
              <Text color="gray.500">No posts found</Text>
            </Box>
          ) : (
            <>
              <SimpleGrid
                columns={{ base: 1, lg: 4, md: 3, sm: 2, xl: 5 }}
                gap={4}
              >
                {posts.map((post) => (
                  <Box key={post.id}>
                    <PostCard post={post} searchParams={searchParams} />
                  </Box>
                ))}
              </SimpleGrid>
              <Pagination
                currentPage={page}
                onPageChange={handlePageChange}
                totalPages={totalPages}
              />
            </>
          )}
        </GridItem>
      </PostsPageLayout>
    </Box>
  );
}
