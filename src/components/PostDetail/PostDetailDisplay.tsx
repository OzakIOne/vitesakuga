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
  contentDraft: string;
  sourceDraft: string;
  tagsDraft: Tag[];
};

type EditAction =
  | {
      type: "startEditing";
      title: string;
      content: string;
      source: string;
      tags: Tag[];
    }
  | { type: "updateTitle"; title: string }
  | { type: "updateContent"; content: string }
  | { type: "updateSource"; source: string }
  | { type: "updateTags"; tags: Tag[] }
  | { type: "stopEditing" };

function editReducer(state: EditState, action: EditAction): EditState {
  switch (action.type) {
    case "startEditing":
      return {
        isEditing: true,
        titleDraft: action.title,
        contentDraft: action.content,
        sourceDraft: action.source,
        tagsDraft: action.tags,
      };
    case "updateTitle":
      return { ...state, titleDraft: action.title };
    case "updateContent":
      return { ...state, contentDraft: action.content };
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
    contentDraft: post.content ?? "",
    sourceDraft: post.source ?? "",
    tagsDraft: initialTags,
  });
  const { isEditing, titleDraft, contentDraft, sourceDraft, tagsDraft } =
    editState;

  const isOwner = currentUserId === user.id;

  const updatePostMutation = useMutationWithFeedback({
    errorFallback: "Failed to update post",
    errorTitle: "Error updating post",
    mutationFn: async (data: {
      title: string;
      content: string;
      source: string | undefined;
      tags: { id?: number; name: string }[];
    }) =>
      updatePost({
        data: {
          content: data.content,
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
      content: post.content ?? "",
      source: post.source ?? "",
      tags: initialTags,
    });
  };

  const save = () => {
    const trimmedTitle = titleDraft.trim();
    if (!trimmedTitle || contentDraft.trim().length < 3) {
      return;
    }
    updatePostMutation.mutate({
      content: contentDraft,
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
              <Field.Label htmlFor="post-content">Content</Field.Label>
              <Textarea
                disabled={updatePostMutation.isPending}
                id="post-content"
                onChange={(e) => {
                  dispatchEdit({
                    type: "updateContent",
                    content: e.target.value,
                  });
                }}
                value={contentDraft}
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
                  contentDraft.trim().length < 3 ||
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
