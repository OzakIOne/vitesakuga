import { Badge, Box, Heading, Stack, Text } from "@chakra-ui/react";
import { Video } from "./Video";
import { User } from "./User";
import { DbSchemaSelect } from "src/auth/db/schema";
import { Link } from "@tanstack/react-router";
import { fetchPost } from "src/lib/posts/posts.fn";

export function Post({
  post,
  user,
  tags,
  relatedPost,
}: {
  post: Awaited<ReturnType<typeof fetchPost>>["post"];
  user: Awaited<ReturnType<typeof fetchPost>>["user"];
  tags?: Array<{ id: number; name: string }>;
  relatedPost?: Partial<DbSchemaSelect["posts"]> | null;
}) {
  return (
    <>
      {post.key && (
        <div className="w-lg">
          <Video url={post.key} bypass={false} />
        </div>
      )}
      {post.title && <Heading as="h3">{post.title}</Heading>}
      {post.content && <Text mb={4}>{post.content}</Text>}

      {tags && tags.length > 0 && (
        <Box mb={4}>
          <Text fontWeight="bold" mb={2}>
            Tags:
          </Text>
          <Stack direction="row" gap={2} flexWrap="wrap">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                colorScheme="blue"
                px={2}
                py={1}
                borderRadius="full"
              >
                {tag.name}
              </Badge>
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
            to="/posts/$postId"
            params={{ postId: String(relatedPost.id) }}
            className="text-blue-500 hover:underline"
          >
            {relatedPost.title}
          </Link>
        </Box>
      )}

      {user.name && <User name={user.name} image={user.image} id={user.id} />}
    </>
  );
}
