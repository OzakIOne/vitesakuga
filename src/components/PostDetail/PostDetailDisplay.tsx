import { Box, Button, VStack } from "@chakra-ui/react";
import { Comments } from "src/components/Comments";
import { Post } from "src/components/Post";
import type { fetchPostDetail } from "src/lib/posts/posts.fn";

interface PostDetailDisplayProps {
  post: Awaited<ReturnType<typeof fetchPostDetail>>["post"];
  user: Awaited<ReturnType<typeof fetchPostDetail>>["user"];
  initialTags: Awaited<ReturnType<typeof fetchPostDetail>>["tags"];
  relatedPost: Awaited<ReturnType<typeof fetchPostDetail>>["relatedPost"];
  currentUserId?: string;
  onEditClick: () => void;
  onBack: () => void;
}

export function PostDetailDisplay({
  post,
  user,
  initialTags,
  relatedPost,
  currentUserId,
  onEditClick,
  onBack,
}: PostDetailDisplayProps) {
  return (
    <VStack gap={4} align="stretch">
      <Button onClick={onBack} alignSelf="flex-start">
        Back
      </Button>

      <Box p={4} borderRadius="md" shadow="md" border="1px">
        <Post
          post={post}
          user={user}
          tags={initialTags}
          relatedPost={relatedPost}
          currentUserId={currentUserId}
          onEditClick={onEditClick}
        />
      </Box>

      <Comments postId={post.id} currentUserId={currentUserId} />
    </VStack>
  );
}
