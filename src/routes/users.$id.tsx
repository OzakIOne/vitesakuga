import { Box, SimpleGrid, Spinner, Stack, Text } from "@chakra-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { NotFound } from "src/components/NotFound";
import { Pagination } from "src/components/Pagination";
import { PostCard } from "src/components/PostCard";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { User } from "src/components/User";
import { UserErrorComponent } from "src/components/UserError";
import { postsSearchSchema } from "src/lib/posts/posts.schema";
import { userQueryOptions } from "src/lib/users/users.queries";

export const Route = createFileRoute("/users/$id")({
  component: UserLayoutComponent,
  errorComponent: UserErrorComponent,
  notFoundComponent: () => {
    return <NotFound>User not found</NotFound>;
  },
  // fix initial window is not defined error
  ssr: "data-only",
  validateSearch: postsSearchSchema,
});

function UserContent() {
  const { id } = Route.useParams();
  const { sortBy, dateRange, tags, q, page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const pageSize = 30;

  const { data } = useSuspenseQuery(
    userQueryOptions({ page, pageSize, q, tags, userId: id }),
  );

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
    <Box p={4}>
      <PostsPageLayout
        dateRange={dateRange}
        fromRoute="/users/$id"
        popularTags={popularTags}
        searchQuery={q}
        selectedTags={tags}
        sortBy={sortBy}
      >
        <User id={data.user.id} image={data.user.image} name={data.user.name} />

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
              h="200px"
              justifyContent="center"
            >
              <Text color="gray.500">No posts found</Text>
            </Box>
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
      </PostsPageLayout>
    </Box>
  );
}

function UserLayoutComponent() {
  return <UserContent />;
}
