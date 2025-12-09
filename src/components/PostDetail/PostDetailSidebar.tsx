import { Badge, Box, Heading, Stack, Text, VStack } from "@chakra-ui/react";
import { Link as RouterLink } from "@tanstack/react-router";
import { SearchBox } from "src/components/SearchBox";
import type { fetchPost } from "src/lib/posts/posts.fn";

interface PostDetailSidebarProps {
  post: Awaited<ReturnType<typeof fetchPost>>["post"];
  initialTags: Awaited<ReturnType<typeof fetchPost>>["tags"];
  relatedPost: Awaited<ReturnType<typeof fetchPost>>["relatedPost"];
}

export function PostDetailSidebar({
  post,
  initialTags,
  relatedPost,
}: PostDetailSidebarProps) {
  return (
    <>
      <Box p={4} borderRadius="md" shadow="md" border="1px">
        <SearchBox />
      </Box>

      {initialTags.length > 0 && (
        <Box p={4} borderRadius="md" shadow="md" border="1px">
          <Heading size="sm" mb={3}>
            Tags
          </Heading>
          <Stack direction="row" flexWrap="wrap" gap={2}>
            {initialTags.map((tag) => (
              <RouterLink
                key={tag.id}
                to="/posts/tags/$tag"
                params={{ tag: tag.name }}
              >
                <Badge px={2} py={1} borderRadius="full" cursor="pointer">
                  {tag.name}
                </Badge>
              </RouterLink>
            ))}
          </Stack>
        </Box>
      )}

      <Box p={4} borderRadius="md" shadow="md" border="1px">
        <Heading size="sm" mb={3}>
          Statistics
        </Heading>
        <VStack align="stretch" gap={2}>
          <Text fontSize="sm">
            <strong>Post ID:</strong> {post.id}
          </Text>
          <Text fontSize="sm">
            <strong>Uploaded:</strong>{" "}
            {new Date(post.createdAt).toLocaleDateString()}
          </Text>
        </VStack>
      </Box>

      {relatedPost && (
        <Box p={4} borderRadius="md" shadow="md" border="1px">
          <Heading size="sm" mb={3}>
            Related Post
          </Heading>
          <RouterLink
            to="/posts/$postId"
            params={{ postId: String(relatedPost.id) }}
          >
            <Text fontSize="sm">{relatedPost.title}</Text>
          </RouterLink>
        </Box>
      )}
    </>
  );
}
