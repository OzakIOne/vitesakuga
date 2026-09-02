import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PostVoteButtons } from "src/components/PostVoteButtons";
import { Button } from "src/components/ui/button";
import { Badge } from "src/components/ui/feedback";
import { Box, HStack, Stack, VStack } from "src/components/ui/layout";

import "yet-another-react-lightbox/styles.css";

import { Image } from "src/components/ui/media";
import { Heading, Text } from "src/components/ui/typography";
import { assetUrl } from "src/lib/assets/url";
import { formatEpisodeInfo } from "src/lib/posts/episode-info";
import type { fetchPostDetail } from "src/lib/posts/posts.service";
import { formatDateUtc } from "src/utils/date-format";
import Lightbox from "yet-another-react-lightbox";
import Download from "yet-another-react-lightbox/plugins/download";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

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
  const imageSrc = images?.[0] ? assetUrl(images[0]) : undefined;
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  return (
    <>
      {post.videoKey ? (
        <Video bypass={false} url={post.videoKey} />
      ) : imageSrc ? (
        <button
          aria-label="Open image in lightbox"
          className="block w-full cursor-zoom-in"
          onClick={() => setIsLightboxOpen(true)}
          type="button"
        >
          <Image
            alt={post.title || "Post image"}
            borderRadius="md"
            src={imageSrc}
            w="full"
          />
        </button>
      ) : null}
      {imageSrc && (
        <Lightbox
          close={() => setIsLightboxOpen(false)}
          open={isLightboxOpen}
          plugins={[Download, Fullscreen, Zoom]}
          render={{
            buttonNext: () => null,
            buttonPrev: () => null,
          }}
          slides={[
            {
              download: true,
              src: imageSrc,
            },
          ]}
          zoom={{ maxZoomPixelRatio: 5, scrollToZoom: true }}
        />
      )}
      {post.title && (
        <HStack justify="space-between">
          <VStack align="start" gap={1}>
            <Heading as="h1" className="break-words">
              {post.title}
            </Heading>
            {episodeInfo && (
              <Text color="gray.500" fontSize="sm">
                {episodeInfo}
              </Text>
            )}
          </VStack>
          <HStack gap={2}>
            {isOwner && onEditClick && (
              <Button onClick={onEditClick} size="sm" variant="outline">
                Edit Post
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
        <Text className="break-words" mb={4}>
          {post.description}
        </Text>
      )}
      {post.createdAt && (
        <Text color="gray.500" fontSize="sm" mb={4}>
          Posted {formatDateUtc(post.createdAt)}
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

      {user.name && <User id={user.id} image={user.image} name={user.name} />}
    </>
  );
}
