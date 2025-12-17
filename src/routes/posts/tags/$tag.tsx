import { Box, Heading } from "@chakra-ui/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { VirtualizedPostList } from "src/components/VirtualizedPostList";
import { postsQueryByTag } from "src/lib/posts/posts.queries";
import { postSearchSchema } from "src/lib/posts/posts.schema";
import { filterAndSortPosts } from "src/lib/posts/posts.utils";

export const Route = createFileRoute("/posts/tags/$tag")({
  component: RouteComponent,
  // fix initial window is not defined error
  ssr: "data-only",
  validateSearch: postSearchSchema,
});

function RouteComponent() {
  const { tag } = Route.useParams();
  const { sortBy, dateRange } = Route.useSearch();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery(postsQueryByTag(tag));

  const allPosts = data?.pages?.flatMap((page) => page.data) ?? [];

  const popularTags = data?.pages?.[0]?.meta?.popularTags ?? [];

  const filteredPosts = useMemo(() => {
    return filterAndSortPosts(allPosts, { dateRange, sortBy });
  }, [allPosts, sortBy, dateRange]);

  if (status === "error") {
    return (
      <Box border="1px" borderRadius="md" p={4}>
        <Heading as="h1" mb={6}>
          Posts tagged with "{tag}"
        </Heading>
        <Box p={4}>Error loading posts</Box>
      </Box>
    );
  }

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

        {filteredPosts.length === 0 ? (
          <Box p={4}>No posts found with this tag.</Box>
        ) : (
          <VirtualizedPostList
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onFetchNextPage={fetchNextPage}
            posts={filteredPosts}
          />
        )}
      </Box>
    </PostsPageLayout>
  );
}
