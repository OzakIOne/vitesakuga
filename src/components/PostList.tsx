import { Box, Heading, HStack, Image, Text, VStack } from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import type { DbSchemaInsert } from "src/lib/db/schema";

function PostListComponent({
  post,
  q,
  pageSize,
}: {
  post: DbSchemaInsert["posts"];
  q: string | undefined;
  pageSize: number | undefined;
}) {
  const BaseURL = encodeURI(
    "https://pub-868cc8261ed54a608c02d025c56645a8.r2.dev/",
  );
  return (
    <Link
      to="/posts/$postId"
      params={{ postId: String(post.id) }}
      search={{
        q,
        size: pageSize,
      }}
    >
      <VStack gap={2} h="full" cursor="pointer">
        {/* Thumbnail Container */}
        <Box
          position="relative"
          w="full"
          overflow="hidden"
          borderRadius="lg"
          bg="gray.900"
          aspectRatio="16 / 9"
          _groupHover={{
            filter: "brightness(0.75)",
          }}
          transitionDuration="200ms"
          transitionProperty="all"
        >
          <Image
            src={`${BaseURL}${post.thumbnailKey}`}
            alt={post.title}
            w="full"
            h="full"
            objectFit="contain"
          />
        </Box>

        {/* Content Container */}
        <HStack gap={3} px={1} w="full">
          {/* Info Container */}
          <VStack gap={1} flex={1} minW={0} align="start">
            <Heading
              as="h3"
              size="sm"
              lineClamp={2}
              _groupHover={{
                color: "gray.600",
              }}
              transitionProperty="colors"
            >
              {post.title}
            </Heading>
            <Text fontSize="xs" color="gray.600" lineClamp={1}>
              {post.content}
            </Text>
          </VStack>
        </HStack>
      </VStack>
    </Link>
  );
}

export const PostList = memo(PostListComponent);
