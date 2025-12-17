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
    <VStack align="stretch" gap={4}>
      <Button alignSelf="flex-start" onClick={onBack}>
        Back
      </Button>

      <Box border="1px" borderRadius="md" p={4} shadow="md">
        <Post
          currentUserId={currentUserId}
          onEditClick={onEditClick}
          post={post}
          relatedPost={relatedPost}
          tags={initialTags}
          user={user}
        />
      </Box>

      <Comments currentUserId={currentUserId} postId={post.id} />
    </VStack>
  );
}
