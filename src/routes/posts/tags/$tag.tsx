import { Box, Heading, SimpleGrid, Spinner, Stack } from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Pagination } from "src/components/Pagination";
import { PostCard } from "src/components/PostCard";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { usePostsPage } from "src/lib/posts/posts.hooks";
import { postsQueryByTag } from "src/lib/posts/posts.queries";
import { searchPostsBaseSchema } from "src/lib/posts/posts.schema";

export const Route = createFileRoute("/posts/tags/$tag")({
  component: RouteComponent,
  // fix initial window is not defined error
  validateSearch: searchPostsBaseSchema,
  ssr: "data-only",
});

function RouteComponent() {
  const { tag } = Route.useParams();
  const { sortBy, dateRange, page } = Route.useSearch();

  const { posts, popularTags, totalPages, handlePageChange, isFetching } =
    usePostsPage(postsQueryByTag({ page, tag }));

  return (
    <PostsPageLayout
      dateRange={dateRange}
      fromRoute="/posts/tags/$tag"
      popularTags={popularTags}
      searchQuery={undefined}
      sortBy={sortBy}
    >
      <Box border="1px" borderRadius="md" p={4}>
        <Heading as="h1" mb={6}>
          Posts tagged with "{tag}"
        </Heading>

        {isFetching && (
          <Stack align="center" justify="center" pb={2}>
            <Spinner size="sm" />
          </Stack>
        )}
        {posts.length === 0 ? (
          <Box p={4}>No posts found with this tag.</Box>
        ) : (
          <>
            <SimpleGrid
              columns={{ base: 1, lg: 4, md: 3, sm: 2, xl: 5 }}
              gap={4}
              mb={8}
            >
              {posts.map((post) => (
                <Box key={post.id}>
                  <PostCard post={post} />
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
      </Box>
    </PostsPageLayout>
  );
}
