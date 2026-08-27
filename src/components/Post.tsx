import { Link } from "@tanstack/react-router";
import { PostVoteButtons } from "src/components/PostVoteButtons";
import { Button } from "src/components/ui/button";
import { Badge } from "src/components/ui/feedback";
import { Box, HStack, Stack, VStack } from "src/components/ui/layout";
import { Image } from "src/components/ui/media";
import { Heading, Text } from "src/components/ui/typography";
import { assetUrl } from "src/lib/assets/url";
import { formatEpisodeInfo } from "src/lib/posts/episode-info";
import type { fetchPostDetail } from "src/lib/posts/posts.service";

import { User } from "./User";
import { Video } from "./Video";

export function Post({
  post,
  user,
  tags,
  relatedPost,
  currentUserId,
  images,
  onEditClick,
  onAddToPlaylist,
  onReportClick,
}: {
  post: Awaited<ReturnType<typeof fetchPostDetail>>["post"];
  user: Awaited<ReturnType<typeof fetchPostDetail>>["user"];
  tags: Awaited<ReturnType<typeof fetchPostDetail>>["tags"];
  relatedPost: Awaited<ReturnType<typeof fetchPostDetail>>["relatedPost"];
  currentUserId?: string | undefined;
  images?: string[] | undefined;
  onEditClick?: (() => void) | undefined;
  onAddToPlaylist?: (() => void) | undefined;
  onReportClick?: (() => void) | undefined;
}) {
  const isOwner = currentUserId === user.id;
  const episodeInfo = formatEpisodeInfo(post);

  return (
    <>
      {post.videoKey ? (
        <Video bypass={false} url={post.videoKey} />
      ) : images?.[0] ? (
        <Image
          alt={post.title || "Post image"}
          borderRadius="md"
          src={assetUrl(images[0])}
          w="full"
        />
      ) : null}
      {post.title && (
        <HStack justify="space-between">
          <VStack align="start" gap={1}>
            <Heading as="h3">{post.title}</Heading>
            {episodeInfo && (
              <Text color="gray.500" fontSize="sm">
                {episodeInfo}
              </Text>
            )}
          </VStack>
          <HStack gap={2}>
            <PostVoteButtons currentUserId={currentUserId} postId={post.id} />
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
            {currentUserId && onReportClick && (
              <Button
                colorPalette="red"
                onClick={onReportClick}
                size="sm"
                variant="outline"
              >
                Report
              </Button>
            )}
          </HStack>
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
