import { Heading, Text, Box, Stack, Badge } from "@chakra-ui/react";
import { Video } from "./Video";
import { User } from "./User";
import { DbSchemaSelect } from "~/auth/db/schema";
import { Link } from "@tanstack/react-router";

export function Post({
  post,
  user,
  tags,
  relatedPost,
}: {
  post: Partial<DbSchemaSelect["posts"]>;
  user: Partial<DbSchemaSelect["user"]>;
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

      {/* Tags */}
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

      {/* Related Post */}
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

      {user?.id && user.name && (
        <User
          user={{
            id: user.id,
            name: user.name,
            image: user.image,
          }}
        />
      )}
    </>
  );
}
