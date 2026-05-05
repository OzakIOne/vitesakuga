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
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { LuTrash2 } from "react-icons/lu";
import { useAddComment, useDeleteComment } from "src/lib/comments/comments.hooks";
import { commentsQueryGetComments } from "src/lib/comments/comments.queries";

type CommentsProps = {
  postId: number;
  currentUserId?: string;
};

function CommentsContent({ postId, currentUserId }: CommentsProps) {
  const [comment, setComment] = useState("");
  const [commentIdToDelete, setCommentIdToDelete] = useState<number | null>(
    null,
  );

  const { data: comments } = useSuspenseQuery(commentsQueryGetComments(postId));

  const addCommentMutation = useAddComment(postId, currentUserId ?? "");
  const deleteCommentMutation = useDeleteComment(postId);

  const handleDeleteComment = () => {
    if (commentIdToDelete !== null) {
      deleteCommentMutation.mutate(
        { commentId: commentIdToDelete },
        { onSuccess: () => setCommentIdToDelete(null) },
      );
    }
  };

  const handleSubmitComment = () => {
    if (!(comment.trim() && currentUserId)) {
      return;
    }
    addCommentMutation.mutate(comment.trim(), {
      onSuccess: () => setComment(""),
    });
  };

  return (
    <Box borderRadius="md" padding="4" shadow="md">
      <Text fontSize="xl" fontWeight="bold" mb={4}>
        Comments
      </Text>

      <Box mb={4}>
        {currentUserId ? (
          <>
            <Textarea
              mb={2}
              onChange={(e) => {
                setComment(e.target.value);
              }}
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
                onClick={() => {
                  setCommentIdToDelete(comment.id);
                }}
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
        onOpenChange={() => {
          setCommentIdToDelete(null);
        }}
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
