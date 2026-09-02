import { ClientOnly, Portal } from "@ark-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import { CommentContent } from "src/components/mentions/CommentContent";
import { MentionTextarea } from "src/components/mentions/MentionTextarea";
import { Button, CloseButton, IconButton } from "src/components/ui/button";
import { Spinner } from "src/components/ui/feedback";
import { Textarea } from "src/components/ui/field";
import { Box, HStack, Stack } from "src/components/ui/layout";
import { Avatar, Card } from "src/components/ui/media";
import { Dialog } from "src/components/ui/overlay";
import { Text } from "src/components/ui/typography";
import {
  useAddComment,
  useDeleteComment,
  useUpdateComment,
} from "src/lib/comments/comments.hooks";
import { commentsQueryGetComments } from "src/lib/comments/comments.queries";
import type { fetchComments } from "src/lib/comments/comments.service";
import { useCommentDraft } from "src/lib/comments/useCommentDraft";
import { deTokenizeForEditing } from "src/lib/mentions/mentions";
import { formatDateUtc } from "src/utils/date-format";

type CommentsProps = {
  postId: number;
  currentUserId?: string | undefined;
};

type CommentRow = Awaited<ReturnType<typeof fetchComments>>[number];

function CommentsContent({ postId, currentUserId }: CommentsProps) {
  const [commentIdToDelete, setCommentIdToDelete] = useState<number | null>(
    null,
  );

  const { data: comments } = useSuspenseQuery(commentsQueryGetComments(postId));

  const deleteCommentMutation = useDeleteComment(postId);

  const handleDeleteComment = () => {
    if (commentIdToDelete !== null) {
      deleteCommentMutation.mutate(
        { commentId: commentIdToDelete },
        { onSuccess: () => setCommentIdToDelete(null) },
      );
    }
  };

  return (
    <Box borderRadius="md" padding="4">
      <Text fontSize="xl" fontWeight="bold" mb={4}>
        Comments
      </Text>

      {currentUserId ? (
        <ClientOnly fallback={null}>
          <CommentComposer currentUserId={currentUserId} postId={postId} />
        </ClientOnly>
      ) : (
        <Box mb={4}>
          <Text color="gray.600" fontStyle="italic">
            You need to be logged in to write a comment.
          </Text>
        </Box>
      )}

      <Box>
        {comments?.map((comment) => (
          <CommentItem
            currentUserId={currentUserId}
            key={comment.id}
            comment={comment}
            onDelete={() => {
              setCommentIdToDelete(comment.id);
            }}
          />
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

function CommentItem({
  comment,
  currentUserId,
  onDelete,
}: {
  comment: CommentRow;
  currentUserId: CommentsProps["currentUserId"];
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  // Stored mention tokens are hydrated to their current handle so the editor
  // only ever shows plain `@handle` text; the server re-canonicalizes on save.
  const [editContent, setEditContent] = useState(() =>
    deTokenizeForEditing(
      comment.content,
      new Map(comment.mentions.map((m) => [m.userId, m.username])),
    ),
  );

  const updateCommentMutation = useUpdateComment(comment.postId);
  const isOwn = currentUserId === comment.userId;

  const handleSave = () => {
    const trimmed = editContent.trim();
    if (!trimmed) {
      return;
    }
    updateCommentMutation.mutate(
      { commentId: comment.id, content: trimmed },
      { onSuccess: () => setIsEditing(false) },
    );
  };

  const handleCancel = () => {
    setEditContent(
      deTokenizeForEditing(
        comment.content,
        new Map(comment.mentions.map((m) => [m.userId, m.username])),
      ),
    );
    setIsEditing(false);
  };

  return (
    <Card.Root mb={3}>
      <Card.Body>
        <HStack align="center" justify="space-between">
          <HStack align="center" gap={2}>
            <Link
              className="flex items-center gap-2 hover:underline"
              params={{ id: comment.userId }}
              to="/users/$id"
            >
              <Avatar.Root size="sm">
                {comment.userImage && (
                  <Avatar.Image
                    src={comment.userImage}
                    alt={comment.userName}
                  />
                )}
                <Avatar.Fallback name={comment.userName} />
              </Avatar.Root>
              <Text fontSize="sm" fontWeight="semibold">
                {comment.userName}
              </Text>
            </Link>
            <Text color="gray.500" fontSize="xs">
              {formatDateUtc(comment.createdAt)}
            </Text>
          </HStack>
          {isOwn && (
            <HStack gap={1}>
              <IconButton
                aria-label="Edit comment"
                flexShrink={0}
                onClick={() => {
                  setIsEditing(true);
                }}
                size="sm"
                variant="ghost"
              >
                <LuPencil />
              </IconButton>
              <IconButton
                aria-label="Delete comment"
                colorScheme="red"
                flexShrink={0}
                onClick={onDelete}
                size="sm"
                variant="ghost"
              >
                <LuTrash2 />
              </IconButton>
            </HStack>
          )}
        </HStack>
        {isEditing ? (
          <Box mt={2}>
            <Textarea
              aria-label="Edit comment"
              autoFocus
              mb={2}
              onChange={(e) => {
                setEditContent(e.target.value);
              }}
              value={editContent}
            />
            <HStack gap={2}>
              <Button
                colorPalette="blue"
                disabled={!editContent.trim()}
                loading={updateCommentMutation.isPending}
                onClick={handleSave}
                size="sm"
              >
                Save
              </Button>
              <Button onClick={handleCancel} size="sm" variant="outline">
                Cancel
              </Button>
            </HStack>
          </Box>
        ) : (
          <CommentContent
            content={comment.content}
            mentions={comment.mentions}
          />
        )}
      </Card.Body>
    </Card.Root>
  );
}

function CommentComposer({
  postId,
  currentUserId,
}: {
  postId: number;
  currentUserId: string;
}) {
  const {
    draft: comment,
    clear: clearDraft,
    setDraft,
  } = useCommentDraft(postId);

  const addCommentMutation = useAddComment(postId, currentUserId);

  const handleSubmitComment = () => {
    if (!comment.trim()) {
      return;
    }
    addCommentMutation.mutate(comment.trim(), {
      onSuccess: clearDraft,
    });
  };

  return (
    <Box mb={4}>
      <MentionTextarea
        label="Write a comment"
        onChange={setDraft}
        placeholder="Write a comment... use @ to mention someone"
        value={comment}
      />
      <Button
        colorScheme="blue"
        disabled={addCommentMutation.isPending || !comment.trim()}
        onClick={handleSubmitComment}
      >
        {addCommentMutation.isPending ? "Adding..." : "Add Comment"}
      </Button>
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
