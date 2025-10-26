import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PostList } from "src/components/PostList";
import { fetchPostsByTag } from "src/lib/tags/tags.fn";
import { z } from "zod";

export const Route = createFileRoute("/posts/tags/$tag")({
  component: RouteComponent,
  validateSearch: z.object({}).parse,
});

function RouteComponent() {
  const { tag } = Route.useParams();

  const { data: posts } = useSuspenseQuery({
    queryKey: ["posts", "byTag", tag],
    queryFn: () => fetchPostsByTag({ data: { tagName: tag } }),
  });

  return (
    <Box p={4}>
      <Heading as="h1" mb={6}>
        Posts tagged with "{tag}"
      </Heading>

      {!posts || posts.length === 0 ? (
        <Text>No posts found with this tag.</Text>
      ) : (
        <Stack direction="row" wrap="wrap" justify="start" gap={4}>
          {posts.map(({ post }) => (
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
  );
}
