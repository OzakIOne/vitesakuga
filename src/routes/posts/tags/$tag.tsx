import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PostList } from "src/components/PostList";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { postsQueryByTag } from "src/lib/posts/posts.queries";
import { postSearchSchema } from "src/lib/posts/posts.schema";
import { filterAndSortPosts } from "src/lib/posts/posts.utils";

export const Route = createFileRoute("/posts/tags/$tag")({
  component: RouteComponent,
  validateSearch: postSearchSchema,
});

function RouteComponent() {
  const { tag } = Route.useParams();
  const { sortBy, dateRange } = Route.useSearch();

  const {
    data: { posts, popularTags },
  } = useSuspenseQuery(postsQueryByTag(tag));

  const allPosts = posts.map(({ post }) => post);

  const filteredPosts = useMemo(() => {
    return filterAndSortPosts(allPosts, { sortBy, dateRange });
  }, [allPosts, sortBy, dateRange]);

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
