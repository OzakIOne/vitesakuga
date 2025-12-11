import { Box, Heading } from "@chakra-ui/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { VirtualizedPostList } from "src/components/VirtualizedPostList";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { postsQueryByTag } from "src/lib/posts/posts.queries";
import { postSearchSchema } from "src/lib/posts/posts.schema";
import { filterAndSortPosts } from "src/lib/posts/posts.utils";

export const Route = createFileRoute("/posts/tags/$tag")({
  component: RouteComponent,
  validateSearch: postSearchSchema,
  // fix initial window is not defined error
  ssr: "data-only",
});

function RouteComponent() {
  const { tag } = Route.useParams();
  const { sortBy, dateRange } = Route.useSearch();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery(postsQueryByTag(tag));

  const allPosts = data?.pages?.flatMap((page) => page.data) ?? [];

  const popularTags = data?.pages?.[0]?.meta?.popularTags ?? [];

  const filteredPosts = useMemo(() => {
    return filterAndSortPosts(allPosts, { sortBy, dateRange });
  }, [allPosts, sortBy, dateRange]);

  if (status === "error") {
    return (
      <Box p={4} borderRadius="md" border="1px">
        <Heading as="h1" mb={6}>
          Posts tagged with "{tag}"
        </Heading>
        <Box p={4}>Error loading posts</Box>
      </Box>
    );
  }

  return (
    <PostsPageLayout
      searchQuery={undefined}
      popularTags={popularTags}
      sortBy={sortBy}
      dateRange={dateRange}
      fromRoute="/posts/tags/$tag"
    >
      <Box p={4} borderRadius="md" border="1px">
        <Heading as="h1" mb={6}>
          Posts tagged with "{tag}"
        </Heading>

        {filteredPosts.length === 0 ? (
          <Box p={4}>No posts found with this tag.</Box>
        ) : (
          <VirtualizedPostList
            posts={filteredPosts}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onFetchNextPage={fetchNextPage}
          />
        )}
      </Box>
    </PostsPageLayout>
  );
}
