import {
  Box,
  Heading,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { Pagination } from "src/components/Pagination";
import { PostCard } from "src/components/PostCard";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { postsQueryByTag } from "src/lib/posts/posts.queries";
import { postsSearchSchema } from "src/lib/posts/posts.schema";

export const Route = createFileRoute("/posts/tags/$tag")({
  component: RouteComponent,
  // fix initial window is not defined error
  ssr: "data-only",
  validateSearch: postsSearchSchema,
});

function RouteComponent() {
  const { tag } = Route.useParams();
  const { sortBy, dateRange, page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const pageSize = 30;

  const { data } = useSuspenseQuery(postsQueryByTag({ page, pageSize, tag }));

  const posts = data.data;
  const popularTags = data.meta.popularTags;
  const { totalPages } = data.meta.pagination;

  const handlePageChange = (newPage: number) => {
    navigate({
      search: (prev) => ({ ...prev, page: newPage }),
    });
    window.scrollTo({ behavior: "smooth", top: 0 });
  };

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

        <Suspense
          fallback={
            <Stack align="center" justify="center" minH="400px">
              <Spinner size="lg" />
              <Text>Loading posts...</Text>
            </Stack>
          }
        >
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
        </Suspense>
      </Box>
    </PostsPageLayout>
  );
}
