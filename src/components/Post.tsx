import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";
import type { fetchPostDetail } from "src/lib/posts/posts.service";

import { User } from "./User";
import { Video } from "./Video";

export function Post({
  post,
  user,
  tags,
  relatedPost,
  currentUserId,
  onEditClick,
  onAddToPlaylist,
}: {
  post: Awaited<ReturnType<typeof fetchPostDetail>>["post"];
  user: Awaited<ReturnType<typeof fetchPostDetail>>["user"];
  tags: Awaited<ReturnType<typeof fetchPostDetail>>["tags"];
  relatedPost: Awaited<ReturnType<typeof fetchPostDetail>>["relatedPost"];
  currentUserId?: string | undefined;
  onEditClick?: (() => void) | undefined;
  onAddToPlaylist?: (() => void) | undefined;
}) {
  const isOwner = currentUserId === user.id;

  return (
    <>
      {post.videoKey && <Video bypass={false} url={post.videoKey} />}
      {post.title && (
        <HStack justify="space-between">
          <Heading as="h3">{post.title}</Heading>
          {currentUserId && onAddToPlaylist && (
            <Button
              colorPalette="blue"
              onClick={onAddToPlaylist}
              size="sm"
              variant="outline"
            >
              Add to playlist
            </Button>
          )}
        </HStack>
      )}
      {post.content && <Text mb={4}>{post.content}</Text>}
      {post.createdAt && (
        <Text color="gray.500" fontSize="sm" mb={4}>
          Posted {new Date(post.createdAt).toLocaleDateString()}
        </Text>
      )}

      {tags.length > 0 && (
        <Box mb={4}>
          <Text fontWeight="bold" mb={2}>
            Tags:
          </Text>
          <Stack direction="row" flexWrap="wrap" gap={2}>
            {tags.map((tag: { id?: number; name: string }) => (
              <Link
                key={tag.id}
                params={{ tag: tag.name }}
                to="/posts/tags/$tag"
              >
                <Badge
                  borderRadius="full"
                  colorPalette="blue"
                  key={tag.id}
                  px={2}
                  py={1}
                  size="lg"
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
