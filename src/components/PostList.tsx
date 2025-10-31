import {
  Box,
  Button,
  Heading,
  HStack,
  Image,
  Text,
  VStack,
} from "@chakra-ui/react";
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
  console.log("Rendering PostListComponent for post:", post);
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
      <Box
        borderWidth="1px"
        borderRadius="2xl"
        overflow="hidden"
        shadow="sm"
        w="48"
        m="2"
        p="4"
      >
        <VStack align="start">
          <Heading as="h2" size="md">
            {post.title}
          </Heading>
          <Text>{post.content}</Text>
          <Image src={`${BaseURL}${post.thumbnailKey}`} alt={post.title} />
          <HStack>
            <Button size="sm" colorScheme="blue">
              View post
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Link>
  );
}

export const PostList = memo(PostListComponent);
