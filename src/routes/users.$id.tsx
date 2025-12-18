import { Box, Spinner, Stack, Text } from "@chakra-ui/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useMemo } from "react";
import { NotFound } from "src/components/NotFound";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { User } from "src/components/User";
import { UserErrorComponent } from "src/components/UserError";
import { VirtualizedPostList } from "src/components/VirtualizedPostList";
import { postsSearchSchema } from "src/lib/posts/posts.schema";
import { filterAndSortPosts } from "src/lib/posts/posts.utils";
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
  const { sortBy, dateRange, tags, q } = Route.useSearch();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery(userQueryOptions(id, tags, q));

  const allPosts = data?.pages?.flatMap((page) => page.data) ?? [];
  const userData = data?.pages?.[0];
  const popularTags = data?.pages?.[0]?.meta?.popularTags ?? [];

  const filteredPosts = useMemo(() => {
    return filterAndSortPosts(allPosts, {
      dateRange,
      sortBy,
    });
  }, [allPosts, sortBy, dateRange]);

  if (status === "error" || !userData) {
    return <NotFound>User not found</NotFound>;
  }

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
        <User
          id={userData.user.id}
          image={userData.user.image}
          name={userData.user.name}
        />

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
      </PostsPageLayout>
    </Box>
  );
}

function UserLayoutComponent() {
  return <UserContent />;
}
