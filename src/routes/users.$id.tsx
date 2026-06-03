import { Box, SimpleGrid, Spinner, Stack, Text } from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import { NotFound } from "src/components/NotFound";
import { Pagination } from "src/components/Pagination";
import { PostCard } from "src/components/PostCard";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { User } from "src/components/User";
import { UserErrorComponent } from "src/components/UserError";
import type { PostListingData } from "src/lib/posts/posts.hooks";
import { usePostsPage } from "src/lib/posts/posts.hooks";
import { searchPostsBaseSchema } from "src/lib/posts/posts.schema";
import { userQueryOptions } from "src/lib/users/users.queries";

type UserPostData = PostListingData & {
  user: { id: string; image: string | null; name: string };
};

export const Route = createFileRoute("/users/$id")({
  component: UserLayoutComponent,
  errorComponent: UserErrorComponent,
  notFoundComponent: () => <NotFound>User not found</NotFound>,
  // fix initial window is not defined error
  ssr: "data-only",
  validateSearch: searchPostsBaseSchema,
});

function UserContent() {
  const { id } = Route.useParams();
  const { sortBy, dateRange, tags, q, page } = Route.useSearch();

  const { posts, popularTags, totalPages, handlePageChange, data, isFetching } =
    usePostsPage<UserPostData>(
      userQueryOptions({ page, q, tags, userId: id }),
    );

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
      </PostsPageLayout>
    </Box>
  );
}

function UserLayoutComponent() {
  return <UserContent />;
}
