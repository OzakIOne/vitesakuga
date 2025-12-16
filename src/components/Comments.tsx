import {
  Box,
  Button,
  Spinner,
  Stack,
  Text,
  Textarea,
  IconButton,
  Dialog,
  Portal,
  CloseButton,
} from "@chakra-ui/react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { LuTrash2 } from "react-icons/lu";
import { addComment, deleteComment } from "src/lib/comments/comments.fn";
import {
  commentsKeys,
  commentsQueryGetComments,
} from "src/lib/comments/comments.queries";
import { toaster } from "./ui/toaster";

interface CommentsProps {
  postId: number;
  currentUserId?: string;
}

function CommentsContent({ postId, currentUserId }: CommentsProps) {
  const [comment, setComment] = useState("");
  const [commentIdToDelete, setCommentIdToDelete] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: comments } = useSuspenseQuery(commentsQueryGetComments(postId));

  const addCommentMutation = useMutation({
    mutationFn: (newComment: {
      postId: number;
      content: string;
      userId: string;
    }) => addComment({ data: newComment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKeys.post(postId) });
      toaster.create({
        type: "success",
        title: "Comment added",
        description: "Your comment has been successfully posted.",
        duration: 3000,
        closable: true,
      });
      setComment("");
    },
    onError: (error) => {
      toaster.create({
        type: "error",
        title: "Error adding comment",
        description: error instanceof Error ? error.message : "Failed to add comment",
        duration: 5000,
        closable: true,
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (data: { commentId: number; postId: number }) =>
      deleteComment({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKeys.post(postId) });
      toaster.create({
        type: "success",
        title: "Comment deleted",
        description: "Your comment has been successfully deleted.",
        duration: 3000,
        closable: true,
      });
    },
    onError: (error) => {
      toaster.create({
        type: "error",
        title: "Error deleting comment",
        description: error instanceof Error ? error.message : "Failed to delete comment",
        duration: 5000,
        closable: true,
      });
    },
  });

  const handleDeleteComment = async () => {
    if (commentIdToDelete !== null) {
      await deleteCommentMutation.mutateAsync({ commentId: commentIdToDelete, postId });
      setCommentIdToDelete(null);
    }
  };

  const handleSubmitComment = async () => {
    if (!comment.trim() || !currentUserId) return;

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
              disabled={addCommentMutation.isPending || !comment.trim()}
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
          <Box
            key={comment.id}
            p={3}
            borderRadius="md"
            shadow="sm"
            mb={3}
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
          >
            <Box flex="1">
              <Text fontSize="sm" color="gray.600" mb={1}>
                {comment.userName || "Anonymous"} •{" "}
                {comment.createdAt
                  ? new Date(comment.createdAt).toLocaleDateString()
                  : "Unknown date"}
              </Text>
              <Text>{comment.content}</Text>
            </Box>
            {currentUserId === comment.userId && (
              <IconButton
                aria-label="Delete comment"
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={() => setCommentIdToDelete(comment.id)}
                loading={deleteCommentMutation.isPending}
                ms={2}
                flexShrink={0}
              >
                <LuTrash2 />
              </IconButton>
            )}
          </Box>
        ))}
      </Box>

      <Dialog.Root
        role="alertdialog"
        open={commentIdToDelete !== null}
        onOpenChange={() => setCommentIdToDelete(null)}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Delete Comment?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <p>Are you sure you want to delete this comment? This action cannot be undone.</p>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.ActionTrigger>
                <Button
                  colorPalette="red"
                  onClick={handleDeleteComment}
                  loading={deleteCommentMutation.isPending}
                >
                  Delete Comment
                </Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
}

export function Comments({ postId, currentUserId }: CommentsProps) {
  return (
    <Suspense
      fallback={
        <Stack gap={4}>
          <Spinner size="sm" />
          <Text>Loading comments...</Text>
        </Stack>
      }
    >
      <CommentsContent postId={postId} currentUserId={currentUserId} />
    </Suspense>
  );
}
