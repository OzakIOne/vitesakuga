import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { Box, Heading, Text, Button, VStack, HStack } from "@chakra-ui/react";
import { DbSchemaSelect } from "~/auth/db/schema";

function PostListComponent({
  post,
  q,
  pageSize,
}: {
  post: DbSchemaSelect["posts"];
  q: string | undefined;
  pageSize: number | undefined;
}) {
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
        {/* ... existing code ... */}
        <VStack align="start">
          <Heading as="h2" size="md">
            {post.title}
          </Heading>
          <Text>{post.content}</Text>
          {/* ... existing code ... */}
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
