import {
  Box,
  Button,
  CloseButton,
  Dialog,
  IconButton,
  Portal,
  Spinner,
  Stack,
  Text,
  Textarea,
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
  const [commentIdToDelete, setCommentIdToDelete] = useState<number | null>(
    null,
  );
  const queryClient = useQueryClient();

  const { data: comments } = useSuspenseQuery(commentsQueryGetComments(postId));

  const addCommentMutation = useMutation({
    mutationFn: (newComment: {
      postId: number;
      content: string;
      userId: string;
    }) => addComment({ data: newComment }),
    onError: (error) => {
      toaster.create({
        closable: true,
        description:
          error instanceof Error ? error.message : "Failed to add comment",
        duration: 5000,
        title: "Error adding comment",
        type: "error",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKeys.post(postId) });
      toaster.create({
        closable: true,
        description: "Your comment has been successfully posted.",
        duration: 3000,
        title: "Comment added",
        type: "success",
      });
      setComment("");
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (data: { commentId: number; postId: number }) =>
      deleteComment({ data }),
    onError: (error) => {
      toaster.create({
        closable: true,
        description:
          error instanceof Error ? error.message : "Failed to delete comment",
        duration: 5000,
        title: "Error deleting comment",
        type: "error",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKeys.post(postId) });
      toaster.create({
        closable: true,
        description: "Your comment has been successfully deleted.",
        duration: 3000,
        title: "Comment deleted",
        type: "success",
      });
    },
  });

  const handleDeleteComment = async () => {
    if (commentIdToDelete !== null) {
      await deleteCommentMutation.mutateAsync({
        commentId: commentIdToDelete,
        postId,
      });
      setCommentIdToDelete(null);
    }
  };

  const handleSubmitComment = async () => {
    if (!comment.trim() || !currentUserId) return;

    await addCommentMutation.mutateAsync({
      content: comment.trim(),
      postId,
      userId: currentUserId,
    });
  };

  return (
    <Box borderRadius={"md"} padding={"4"} shadow={"md"}>
      <Text fontSize="xl" fontWeight="bold" mb={4}>
        Comments
      </Text>

      <Box mb={4}>
        {currentUserId ? (
          <>
            <Textarea
              mb={2}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write a comment..."
              value={comment}
            />
            <Button
              colorScheme="blue"
              disabled={addCommentMutation.isPending || !comment.trim()}
              onClick={handleSubmitComment}
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
            alignItems="flex-start"
            borderRadius="md"
            display="flex"
            justifyContent="space-between"
            key={comment.id}
            mb={3}
            p={3}
            shadow="sm"
          >
            <Box flex="1">
              <Text color="gray.600" fontSize="sm" mb={1}>
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
                colorScheme="red"
                flexShrink={0}
                loading={deleteCommentMutation.isPending}
                ms={2}
                onClick={() => setCommentIdToDelete(comment.id)}
                size="sm"
                variant="ghost"
              >
                <LuTrash2 />
              </IconButton>
            )}
          </Box>
        ))}
      </Box>

      <Dialog.Root
        onOpenChange={() => setCommentIdToDelete(null)}
        open={commentIdToDelete !== null}
        role="alertdialog"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Delete Comment?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <p>
                  Are you sure you want to delete this comment? This action
                  cannot be undone.
                </p>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.ActionTrigger>
                <Button
                  colorPalette="red"
                  loading={deleteCommentMutation.isPending}
                  onClick={handleDeleteComment}
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
      <CommentsContent currentUserId={currentUserId} postId={postId} />
    </Suspense>
  );
}
