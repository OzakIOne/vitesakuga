import { Box, Heading, HStack, Image, Text, VStack } from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import type { DbSchemaSelect } from "src/lib/db/schema";

type PostListProps = {
  post: DbSchemaSelect["posts"];
  q?: string;
  pageSize?: number;
};

function PostCardComponent({ post, q, pageSize }: PostListProps) {
  const BaseURL = encodeURI(
    "https://pub-868cc8261ed54a608c02d025c56645a8.r2.dev/",
  );
  return (
    <Link
      params={{ postId: post.id }}
      search={{
        q,
        size: pageSize,
      }}
      to="/posts/$postId"
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
            src={`${BaseURL}${post.thumbnailKey}`}
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
          </VStack>
        </HStack>
      </VStack>
    </Link>
  );
}

export const PostCard = memo(PostCardComponent);
