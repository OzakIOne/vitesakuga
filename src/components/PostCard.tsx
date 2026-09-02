import { Portal } from "@ark-ui/react";
import { Link, useRouteContext } from "@tanstack/react-router";
import { memo, useState } from "react";
import {
  LuEllipsisVertical,
  LuFlag,
  LuListPlus,
  LuShare2,
  LuThumbsDown,
  LuThumbsUp,
} from "react-icons/lu";
import { PlaylistAddModal } from "src/components/PlaylistAddModal";
import { ReportDialog } from "src/components/ReportDialog";
import { IconButton } from "src/components/ui/button";
import { Box, HStack, VStack } from "src/components/ui/layout";
import { Image } from "src/components/ui/media";
import { Menu } from "src/components/ui/overlay";
import { toaster } from "src/components/ui/toaster";
import { Heading, Text } from "src/components/ui/typography";
import { assetUrl } from "src/lib/assets/url";
import type { PostWithVotes } from "src/lib/db/schema";
import { formatEpisodeInfo } from "src/lib/posts/episode-info";
import type { PostsSearchParams } from "src/lib/posts/posts.schema";
import { formatDateUtc } from "src/utils/date-format";

type PostListProps = {
  post: PostWithVotes;
  searchParams?: PostsSearchParams;
};

function PostCardMenu({ post }: { post: PostWithVotes }) {
  const { user } = useRouteContext({ from: "__root__" });
  const currentUserId = user?.id;
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  const handleShare = () => {
    const url = `${window.location.origin}/posts/${post.id}`;
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        toaster.create({
          description: url,
          duration: 2000,
          title: "Link copied",
          type: "success",
        });
      })
      .catch(() => {
        toaster.create({
          description: "Could not copy the link.",
          duration: 2000,
          title: "Copy failed",
          type: "error",
        });
      });
  };

  return (
    <>
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton aria-label={`Post actions for ${post.title}`} size="xs">
            <LuEllipsisVertical />
          </IconButton>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item onClick={handleShare} value="share">
                <LuShare2 />
                Share
              </Menu.Item>
              {currentUserId && (
                <Menu.Item
                  onClick={() => {
                    setShowPlaylistModal(true);
                  }}
                  value="playlist"
                >
                  <LuListPlus />
                  Add to playlist
                </Menu.Item>
              )}
              {currentUserId && (
                <Menu.Item
                  onClick={() => {
                    setShowReportDialog(true);
                  }}
                  value="report"
                >
                  <LuFlag />
                  Report
                </Menu.Item>
              )}
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
      {showPlaylistModal && currentUserId && (
        <PlaylistAddModal
          onCancel={() => {
            setShowPlaylistModal(false);
          }}
          postId={post.id}
          userId={currentUserId}
        />
      )}
      {showReportDialog && currentUserId && (
        <ReportDialog
          onCancel={() => {
            setShowReportDialog(false);
          }}
          postId={post.id}
        />
      )}
    </>
  );
}

function PostCardComponent({ post, searchParams }: PostListProps) {
  const episodeInfo = formatEpisodeInfo(post);
  return (
    <Box h="full">
      <VStack cursor="pointer" gap={2} h="full">
        <Link
          className="group"
          params={{ postId: post.id }}
          to="/posts/$postId"
          {...(searchParams ? { search: searchParams } : {})}
        >
          <Box
            _groupHover={{
              filter: "brightness(0.75)",
            }}
            aspectRatio="16 / 9"
            bg="gray.900"
            borderRadius="lg"
            overflow="hidden"
            transitionDuration="200ms"
            transitionProperty="filter"
            w="full"
          >
            <Image
              alt={post.title}
              h="full"
              objectFit="contain"
              src={assetUrl(post.thumbnailKey)}
              w="full"
            />
          </Box>
        </Link>

        {/* Content Container */}
        <VStack align="start" gap={1} px={1} w="full">
          <HStack alignItems="start" gap={1} w="full">
            <Link
              className="group min-w-0 flex-1"
              params={{ postId: post.id }}
              to="/posts/$postId"
              {...(searchParams ? { search: searchParams } : {})}
            >
              <Heading
                _groupHover={{
                  color: "gray.600",
                }}
                as="h3"
                lineClamp={2}
                size="sm"
                transitionProperty="colors"
              >
                {post.title}
              </Heading>
            </Link>
            <PostCardMenu post={post} />
          </HStack>
          {/* Info Container */}
          <Link
            className="group w-full"
            params={{ postId: post.id }}
            to="/posts/$postId"
            {...(searchParams ? { search: searchParams } : {})}
          >
            <VStack align="start" gap={1} minW={0}>
              <Text color="gray.600" fontSize="xs" lineClamp={1}>
                {post.description}
              </Text>
              {episodeInfo && (
                <Text color="blue.500" fontSize="xs" lineClamp={1}>
                  {episodeInfo}
                </Text>
              )}
              <Text color="gray.500" fontSize="xs">
                {formatDateUtc(post.createdAt)}
              </Text>
              <HStack gap={3}>
                <Text className="tabular-nums" color="gray.500" fontSize="xs">
                  <LuThumbsUp aria-hidden className="mr-1 inline" />
                  {post.likes}
                </Text>
                <Text className="tabular-nums" color="gray.500" fontSize="xs">
                  <LuThumbsDown aria-hidden className="mr-1 inline" />
                  {post.dislikes}
                </Text>
              </HStack>
            </VStack>
          </Link>
        </VStack>
      </VStack>
    </Box>
  );
}

export const PostCard = memo(PostCardComponent);
