import { Badge, Box, Button, Heading, Stack, Text } from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";
import type { fetchPostDetail } from "src/lib/posts/posts.fn";
import { User } from "./User";
import { Video } from "./Video";

export function Post({
  post,
  user,
  tags,
  relatedPost,
  currentUserId,
  onEditClick,
}: {
  post: Awaited<ReturnType<typeof fetchPostDetail>>["post"];
  user: Awaited<ReturnType<typeof fetchPostDetail>>["user"];
  tags: Awaited<ReturnType<typeof fetchPostDetail>>["tags"];
  relatedPost: Awaited<ReturnType<typeof fetchPostDetail>>["relatedPost"];
  currentUserId?: string;
  onEditClick?: () => void;
}) {
  const isOwner = currentUserId === user.id;

  return (
    <>
      {post.videoKey && (
        <div className="w-lg">
          <Video url={post.videoKey} bypass={false} />
        </div>
      )}
      {post.title && <Heading as="h3">{post.title}</Heading>}
      {post.content && <Text mb={4}>{post.content}</Text>}

      {tags && tags.length > 0 && (
        <Box mb={4}>
          <Text fontWeight="bold" mb={2}>
            Tags:
          </Text>
          <Stack direction="row" gap={2} flexWrap="wrap">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                to="/posts/tags/$tag"
                params={{ tag: tag.name }}
              >
                <Badge
                  key={tag.id}
                  colorScheme="blue"
                  px={2}
                  py={1}
                  borderRadius="full"
                >
                  {tag.name}
                </Badge>
              </Link>
            ))}
          </Stack>
        </Box>
      )}

      {relatedPost && (
        <Box mb={4}>
          <Text fontWeight="bold" mb={2}>
            Related Post:
          </Text>
          <Link
            to="/posts/$postId"
            params={{ postId: relatedPost.id }}
            className="text-blue-500 hover:underline"
          >
            {relatedPost.title}
          </Link>
        </Box>
      )}

      {isOwner && onEditClick && (
        <Box mb={4}>
          <Button onClick={onEditClick} colorScheme="blue">
            Edit Post
          </Button>
        </Box>
      )}

      {user.name && <User name={user.name} image={user.image} id={user.id} />}
    </>
  );
}
