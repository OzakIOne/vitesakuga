import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { LuThumbsDown, LuThumbsUp } from "react-icons/lu";
import { Box, HStack, VStack } from "src/components/ui/layout";
import { Image } from "src/components/ui/media";
import { Heading, Text } from "src/components/ui/typography";
import { assetUrl } from "src/lib/assets/url";
import type { PostWithVotes } from "src/lib/db/schema";
import type { PostsSearchParams } from "src/lib/posts/posts.schema";

type PostListProps = {
  post: PostWithVotes;
  searchParams?: PostsSearchParams;
};

function PostCardComponent({ post, searchParams }: PostListProps) {
  return (
    <Link
      className="group"
      params={{ postId: post.id }}
      to="/posts/$postId"
      {...(searchParams ? { search: searchParams } : {})}
    >
      <VStack cursor="pointer" gap={2} h="full">
        <Box
          _groupHover={{
            filter: "brightness(0.75)",
          }}
          aspectRatio="16 / 9"
          bg="gray.900"
          borderRadius="lg"
          overflow="hidden"
          position="relative"
          transitionDuration="200ms"
          transitionProperty="all"
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

        {/* Content Container */}
        <HStack gap={3} px={1} w="full">
          {/* Info Container */}
          <VStack align="start" flex={1} gap={1} minW={0}>
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
            <Text color="gray.600" fontSize="xs" lineClamp={1}>
              {post.content}
            </Text>
            <Text color="gray.500" fontSize="xs">
              {new Date(post.createdAt).toLocaleDateString()}
            </Text>
            <HStack gap={3}>
              <Text color="gray.500" fontSize="xs">
                <LuThumbsUp aria-hidden className="mr-1 inline" />
                {post.likes}
              </Text>
              <Text color="gray.500" fontSize="xs">
                <LuThumbsDown aria-hidden className="mr-1 inline" />
                {post.dislikes}
              </Text>
            </HStack>
          </VStack>
        </HStack>
      </VStack>
    </Link>
  );
}

export const PostCard = memo(PostCardComponent);
