import { Box, Button, Text, Textarea } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { addComment } from "src/lib/comments/comments.fn";
import { commentsQueryOptions } from "src/lib/comments/comments.queries";

interface CommentsProps {
  postId: number;
  currentUserId?: string;
}

export function Comments({ postId, currentUserId }: CommentsProps) {
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();

  // Fetch comments with useQuery
  const { data: comments } = useQuery(commentsQueryOptions(postId));

  const addCommentMutation = useMutation({
    mutationFn: (newComment: {
      postId: number;
      content: string;
      userId: string;
    }) => addComment({ data: newComment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      setComment("");
    },
  });

  const handleSubmitComment = async () => {
    if (!comment.trim()) return;

    if (!currentUserId) {
      console.error("Missing currentUserId");
      return;
    }

    await addCommentMutation.mutateAsync({
      postId,
      content: comment.trim(),
      userId: currentUserId,
    });
  };

  return (
    <Box shadow={"md"} borderRadius={"md"} padding={"4"}>
      <Text fontSize="xl" fontWeight="bold" mb={4}>
        Comments
      </Text>

      <Box mb={4}>
        {currentUserId ? (
          <>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write a comment..."
              mb={2}
            />
            <Button
              onClick={handleSubmitComment}
              disabled={addCommentMutation.isPending}
              colorScheme="blue"
            >
              {addCommentMutation.isPending ? "Adding..." : "Add Comment"}
            </Button>
          </>
        ) : (
          <Text color="gray.600" fontStyle="italic">
            You need to be logged in to write a comment.
          </Text>
        )}
      </Box>

      <Box>
        {comments?.map((comment) => (
          <Box key={comment.id} p={3} borderRadius="md" shadow="sm" mb={3}>
            <Text fontSize="sm" color="gray.600" mb={1}>
              {comment.userName || "Anonymous"} •{" "}
              {comment.createdAt
                ? new Date(comment.createdAt).toLocaleDateString()
                : "Unknown date"}
            </Text>
            <Text>{comment.content}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
