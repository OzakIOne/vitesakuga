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
          <Video bypass={false} url={post.videoKey} />
        </div>
      )}
      {post.title && <Heading as="h3">{post.title}</Heading>}
      {post.content && <Text mb={4}>{post.content}</Text>}

      {tags && tags.length > 0 && (
        <Box mb={4}>
          <Text fontWeight="bold" mb={2}>
            Tags:
          </Text>
          <Stack direction="row" flexWrap="wrap" gap={2}>
            {tags.map((tag) => (
              <Link key={tag.id} params={{ tag: tag.name }} to="/posts/tags/$tag">
                <Badge borderRadius="full" colorScheme="blue" key={tag.id} px={2} py={1}>
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
            className="text-blue-500 hover:underline"
            params={{ postId: relatedPost.id }}
            to="/posts/$postId"
          >
            {relatedPost.title}
          </Link>
        </Box>
      )}

      {isOwner && onEditClick && (
        <Box mb={4}>
          <Button colorScheme="blue" onClick={onEditClick}>
            Edit Post
          </Button>
        </Box>
      )}

      {user.name && <User id={user.id} image={user.image} name={user.name} />}
    </>
  );
}
