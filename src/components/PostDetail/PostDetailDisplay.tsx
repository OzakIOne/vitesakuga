import { useQueryClient } from "@tanstack/react-query";
import { useReducer, useState } from "react";
import { Comments } from "src/components/Comments";
import { PlaylistAddModal } from "src/components/PlaylistAddModal";
import { Post } from "src/components/Post";
import { ReportDialog } from "src/components/ReportDialog";
import { Button } from "src/components/ui/button";
import { Field, Input, Textarea } from "src/components/ui/field";
import { Box, HStack, VStack } from "src/components/ui/layout";
import { TagInput } from "src/components/ui/tag-input";
import { useMutationWithFeedback } from "src/lib/mutations/mutation-feedback";
import { postsKeys } from "src/lib/posts/posts.queries";
import type { Tag } from "src/lib/posts/posts.schema";
import type { fetchPostDetail } from "src/lib/posts/posts.service";
import { updatePost } from "src/lib/posts/posts.service";

type PostDetailDisplayProps = {
  post: Awaited<ReturnType<typeof fetchPostDetail>>["post"];
  user: Awaited<ReturnType<typeof fetchPostDetail>>["user"];
  initialTags: Awaited<ReturnType<typeof fetchPostDetail>>["tags"];
  relatedPost: Awaited<ReturnType<typeof fetchPostDetail>>["relatedPost"];
  images?: string[] | undefined;
  currentUserId?: string | undefined;
};

type EditState = {
  isEditing: boolean;
  titleDraft: string;
  descriptionDraft: string;
  sourceDraft: string;
  tagsDraft: Tag[];
};

type EditAction =
  | {
      type: "startEditing";
      title: string;
      description: string;
      source: string;
      tags: Tag[];
    }
  | { type: "updateTitle"; title: string }
  | { type: "updateDescription"; description: string }
  | { type: "updateSource"; source: string }
  | { type: "updateTags"; tags: Tag[] }
  | { type: "stopEditing" };

function editReducer(state: EditState, action: EditAction): EditState {
  switch (action.type) {
    case "startEditing":
      return {
        isEditing: true,
        titleDraft: action.title,
        descriptionDraft: action.description,
        sourceDraft: action.source,
        tagsDraft: action.tags,
      };
    case "updateTitle":
      return { ...state, titleDraft: action.title };
    case "updateDescription":
      return { ...state, descriptionDraft: action.description };
    case "updateSource":
      return { ...state, sourceDraft: action.source };
    case "updateTags":
      return { ...state, tagsDraft: action.tags };
    case "stopEditing":
      return { ...state, isEditing: false };
    default:
      return state;
  }
}

export function PostDetailDisplay({
  post,
  user,
  initialTags,
  relatedPost,
  images,
  currentUserId,
}: PostDetailDisplayProps) {
  const queryClient = useQueryClient();
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [editState, dispatchEdit] = useReducer(editReducer, {
    isEditing: false,
    titleDraft: post.title ?? "",
    descriptionDraft: post.description ?? "",
    sourceDraft: post.source ?? "",
    tagsDraft: initialTags,
  });
  const { isEditing, titleDraft, descriptionDraft, sourceDraft, tagsDraft } =
    editState;

  const isOwner = currentUserId === user.id;

  const updatePostMutation = useMutationWithFeedback({
    errorFallback: "Failed to update post",
    errorTitle: "Error updating post",
    mutationFn: async (data: {
      title: string;
      description: string;
      source: string | undefined;
      tags: { id?: number; name: string }[];
    }) =>
      updatePost({
        data: {
          description: data.description,
          postId: post.id,
          relatedPostId: post.relatedPostId ?? undefined,
          source: data.source,
          tags: data.tags,
          title: data.title,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: postsKeys.detail(post.id),
      });
      dispatchEdit({ type: "stopEditing" });
    },
    successDescription: "Your post has been updated.",
    successTitle: "Post updated",
  });

  const startEditing = () => {
    dispatchEdit({
      type: "startEditing",
      title: post.title ?? "",
      description: post.description ?? "",
      source: post.source ?? "",
      tags: initialTags,
    });
  };

  const save = () => {
    const trimmedTitle = titleDraft.trim();
    if (!trimmedTitle || descriptionDraft.trim().length < 3) {
      return;
    }
    updatePostMutation.mutate({
      description: descriptionDraft,
      source: sourceDraft.trim() || undefined,
      tags: tagsDraft,
      title: trimmedTitle,
    });
  };

  return (
    <VStack align="stretch" gap={4}>
      <Box border="1px" borderRadius="md" p={4} shadow="md">
        {isEditing && isOwner ? (
          <div className="space-y-4">
            <Input
              aria-label="Post title"
              autoFocus
              className="h-auto px-2 py-1 text-2xl font-bold"
              disabled={updatePostMutation.isPending}
              onChange={(e) => {
                dispatchEdit({ type: "updateTitle", title: e.target.value });
              }}
              value={titleDraft}
            />
            <Field.Root>
              <Field.Label htmlFor="post-description">Description</Field.Label>
              <Textarea
                disabled={updatePostMutation.isPending}
                id="post-description"
                onChange={(e) => {
                  dispatchEdit({
                    type: "updateDescription",
                    description: e.target.value,
                  });
                }}
                value={descriptionDraft}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label htmlFor="post-source">Source URL</Field.Label>
              <Input
                disabled={updatePostMutation.isPending}
                id="post-source"
                onChange={(e) => {
                  dispatchEdit({
                    type: "updateSource",
                    source: e.target.value,
                  });
                }}
                placeholder="Link to the original source (Twitter, YouTube, etc.)"
                value={sourceDraft}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>Tags</Field.Label>
              <TagInput
                onChange={(tags) => dispatchEdit({ type: "updateTags", tags })}
                value={tagsDraft}
              />
            </Field.Root>
            <HStack gap={2}>
              <Button
                disabled={
                  !titleDraft.trim() ||
                  descriptionDraft.trim().length < 3 ||
                  updatePostMutation.isPending
                }
                loading={updatePostMutation.isPending}
                onClick={save}
              >
                Save
              </Button>
              <Button
                disabled={updatePostMutation.isPending}
                onClick={() => {
                  dispatchEdit({ type: "stopEditing" });
                }}
                variant="ghost"
              >
                Cancel
              </Button>
            </HStack>
          </div>
        ) : (
          <Post
            currentUserId={currentUserId}
            images={images}
            onAddToPlaylist={
              currentUserId ? () => setShowPlaylistModal(true) : undefined
            }
            onEditClick={isOwner ? startEditing : undefined}
            onReportClick={
              currentUserId && !isOwner
                ? () => {
                    setShowReportDialog(true);
                  }
                : undefined
            }
            post={post}
            relatedPost={relatedPost}
            tags={initialTags}
            user={user}
          />
        )}
      </Box>

      {showPlaylistModal && currentUserId && (
        <PlaylistAddModal
          onCancel={() => {
            setShowPlaylistModal(false);
          }}
          postId={post.id}
          userId={currentUserId}
        />
      )}

      {showReportDialog && currentUserId && (
        <ReportDialog
          onCancel={() => {
            setShowReportDialog(false);
          }}
          postId={post.id}
        />
      )}

      <Comments currentUserId={currentUserId} postId={post.id} />
    </VStack>
  );
}
