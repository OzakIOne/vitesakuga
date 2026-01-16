import {
  Box,
  GridItem,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useCallback } from "react";
import { Pagination } from "src/components/Pagination";
import { PostCard } from "src/components/PostCard";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { envClient } from "src/lib/env/client";
import { postsQueryOptions } from "src/lib/posts/posts.queries";
import { searchPostsBaseSchema } from "src/lib/posts/posts.schema";

export const Route = createFileRoute("/posts/")({
  component: PostsContent,
  ssr: "data-only",
  validateSearch: searchPostsBaseSchema,
});

function PostsContent() {
  const searchParams = Route.useSearch();
  const { q, tags, sortBy, dateRange, page } = searchParams;
  const navigate = Route.useNavigate();

  const { data } = useSuspenseQuery(postsQueryOptions(searchParams));

  const posts = data.data;
  const { totalPages } = data.meta.pagination;

  const handlePageChange = useCallback(
    (newPage: number) => {
      navigate({
        search: (prev) => ({ ...prev, page: newPage }),
      });
      window.scrollTo({ behavior: "smooth", top: 0 });
    },
    [navigate],
  );

  return (
    <Box p={4} w="full">
      {envClient.MODE === "development" && (
        <VStack align="start" borderBottom="1px" mb={4} p={4}>
          <Text fontSize="sm">Posts loaded: {posts.length}</Text>
          <Text fontSize="sm">Total posts: {data.meta.pagination.total}</Text>
          <Text fontSize="sm">Current page: {page}</Text>
          <Text fontSize="sm">Total pages: {totalPages}</Text>
        </VStack>
      )}
      <PostsPageLayout
        dateRange={dateRange}
        fromRoute="/posts"
        popularTags={data.meta.popularTags}
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
          </Suspense>
        </GridItem>
      </PostsPageLayout>
    </Box>
  );
}
