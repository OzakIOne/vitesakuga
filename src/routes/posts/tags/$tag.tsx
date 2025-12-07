import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PostList } from "src/components/PostList";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { postsFilterSearchSchema } from "src/lib/posts/posts.schema";
import { filterAndSortPosts } from "src/lib/posts/posts.utils";
import { getPostsByTag } from "src/lib/tags/tags.fn";

export const Route = createFileRoute("/posts/tags/$tag")({
  component: RouteComponent,
  validateSearch: postsFilterSearchSchema,
});

function RouteComponent() {
  const { tag } = Route.useParams();
  const { sortBy: urlSortBy, dateRange: urlDateRange } = Route.useSearch();

  const sortBy = urlSortBy || "latest";
  const dateRange = urlDateRange || "all";

  const { data: posts } = useSuspenseQuery({
    queryKey: ["posts", "byTag", tag],
    queryFn: () => getPostsByTag({ data: { tagName: tag } }),
  });

  // Extract posts and apply filters
  const allPosts = posts?.map(({ post }) => post) ?? [];

  const filteredPosts = useMemo(() => {
    return filterAndSortPosts(allPosts, { sortBy, dateRange });
  }, [allPosts, sortBy, dateRange]);

  // Calculate popular tags from the filtered posts
  const popularTags = useMemo(() => {
    // For the tag page, we could show related tags or just return empty
    // since we're already filtering by a specific tag
    return [];
  }, []);

  return (
    <PostsPageLayout
      searchQuery={undefined}
      popularTags={popularTags}
      sortBy={sortBy}
      dateRange={dateRange}
    >
      <Box p={4} borderRadius="md" border="1px">
        <Heading as="h1" mb={6}>
          Posts tagged with "{tag}"
        </Heading>

        {filteredPosts.length === 0 ? (
          <Text>No posts found with this tag.</Text>
        ) : (
          <Stack direction="row" wrap="wrap" justify="start" gap={4}>
            {filteredPosts.map((post) => (
              <PostList
                key={post.id}
                post={post}
                q={undefined}
                pageSize={undefined}
              />
            ))}
          </Stack>
        )}
      </Box>
    </PostsPageLayout>
  );
}
