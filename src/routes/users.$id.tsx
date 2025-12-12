import { Box } from "@chakra-ui/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { NotFound } from "src/components/NotFound";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { User } from "src/components/User";
import { UserErrorComponent } from "src/components/UserError";
import { VirtualizedPostList } from "src/components/VirtualizedPostList";
import { postSearchSchema } from "src/lib/posts/posts.schema";
import { filterAndSortPosts } from "src/lib/posts/posts.utils";
import { userQueryOptions } from "src/lib/users/users.queries";

export const Route = createFileRoute("/users/$id")({
  validateSearch: postSearchSchema,
  errorComponent: UserErrorComponent,
  component: UserComponent,
  // fix initial window is not defined error
  ssr: "data-only",
  notFoundComponent: () => {
    return <NotFound>User not found</NotFound>;
  },
});

function UserComponent() {
  const { id } = Route.useParams();
  const { sortBy, dateRange } = Route.useSearch();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery(userQueryOptions(id));

  const allPosts = data?.pages?.flatMap((page) => page.data) ?? [];
  const userData = data?.pages?.[0];

  const filteredPosts = useMemo(() => {
    return filterAndSortPosts(allPosts, {
      sortBy,
      dateRange,
    });
  }, [allPosts, sortBy, dateRange]);

  if (status === "error" || !userData) {
    return <NotFound>User not found</NotFound>;
  }

  return (
    <Box p={4}>
      <PostsPageLayout
        searchQuery={undefined}
        popularTags={userData.meta?.popularTags ?? []}
        sortBy={sortBy}
        dateRange={dateRange}
        fromRoute="/users/$id"
      >
        <User
          name={userData.user.name}
          image={userData.user.image}
          id={userData.user.id}
        />

        <VirtualizedPostList
          posts={filteredPosts}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onFetchNextPage={fetchNextPage}
        />
      </PostsPageLayout>
    </Box>
  );
}
