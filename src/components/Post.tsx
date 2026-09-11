import { Link } from "@tanstack/react-router";
import { PostImageGallery } from "src/components/PostImageGallery";
import { PostVoteButtons } from "src/components/PostVoteButtons";
import { Button } from "src/components/ui/button";
import { Badge } from "src/components/ui/feedback";
import { Box, HStack, Stack, VStack } from "src/components/ui/layout";
import { Heading, Text } from "src/components/ui/typography";
import { formatEpisodeInfo } from "src/lib/posts/episode-info";
import type { fetchPostDetail } from "src/lib/posts/posts.service";
import { formatDateUtc } from "src/utils/date-format";

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
  onSuggestEditClick,
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
  onSuggestEditClick?: (() => void) | undefined;
}) {
  const isOwner = currentUserId === user.id;
  const episodeInfo = formatEpisodeInfo(post);

  return (
    <>
      {post.videoKey ? (
        <Video bypass={false} url={post.videoKey} />
      ) : images && images.length > 0 ? (
        <PostImageGallery images={images} title={post.title} />
      ) : null}
      {post.title && (
        <HStack align="start" flexWrap="wrap" justify="space-between">
          <VStack align="start" className="min-w-0 flex-1" gap={1}>
            <Heading as="h1" className="break-words">
              {post.title}
            </Heading>
            {episodeInfo && (
              <Text color="gray.500" fontSize="sm">
                {post.animeTitle ? (
                  <Link
                    className="hover:underline"
                    params={{ seriesTitle: post.animeTitle }}
                    to="/series/$seriesTitle"
                  >
                    {episodeInfo}
                  </Link>
                ) : (
                  episodeInfo
                )}
              </Text>
            )}
          </VStack>
          <HStack flexWrap="wrap" gap={2}>
            {isOwner && onEditClick && (
              <Button onClick={onEditClick} size="sm" variant="outline">
                Edit Post
              </Button>
            )}
            {!isOwner && onSuggestEditClick && (
              <Button onClick={onSuggestEditClick} size="sm" variant="outline">
                Suggest an edit
              </Button>
            )}
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
      {post.description && (
        <Text className="break-words whitespace-pre-wrap" mb={4}>
          {post.description}
        </Text>
      )}
      {post.createdAt && (
        <Text color="gray.500" fontSize="sm" mb={4}>
          Posted {formatDateUtc(post.createdAt)}
        </Text>
      )}

      {post.source && (
        <Text color="gray.500" fontSize="sm" mb={4}>
          Source:{" "}
          <a href={post.source} rel="noopener noreferrer" target="_blank">
            View original
          </a>
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
            params={{ postId: String(relatedPost.id) }}
            to="/posts/$postId"
          >
            {relatedPost.title}
          </Link>
        </Box>
      )}

      {user.name && <User id={user.id} image={user.image} name={user.name} />}
    </>
  );
}
