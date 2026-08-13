import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Comments } from "src/components/Comments";
import { PlaylistAddModal } from "src/components/PlaylistAddModal";
import { Post } from "src/components/Post";
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
  currentUserId?: string | undefined;
};

export function PostDetailDisplay({
  post,
  user,
  initialTags,
  relatedPost,
  currentUserId,
}: PostDetailDisplayProps) {
  const queryClient = useQueryClient();
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(post.title ?? "");
  const [contentDraft, setContentDraft] = useState(post.content ?? "");
  const [sourceDraft, setSourceDraft] = useState(post.source ?? "");
  const [tagsDraft, setTagsDraft] = useState<Tag[]>(initialTags);

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
      setIsEditing(false);
    },
    successDescription: "Your post has been updated.",
    successTitle: "Post updated",
  });

  const startEditing = () => {
    setTitleDraft(post.title ?? "");
    setContentDraft(post.content ?? "");
    setSourceDraft(post.source ?? "");
    setTagsDraft(initialTags);
    setIsEditing(true);
  };

  const save = () => {
    const trimmedTitle = titleDraft.trim();
    if (!trimmedTitle || contentDraft.trim().length < 3) {
      return;
    }
    void updatePostMutation.mutate({
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
                setTitleDraft(e.target.value);
              }}
              value={titleDraft}
            />
            <Field.Root>
              <Field.Label htmlFor="post-content">Content</Field.Label>
              <Textarea
                disabled={updatePostMutation.isPending}
                id="post-content"
                onChange={(e) => {
                  setContentDraft(e.target.value);
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
                  setSourceDraft(e.target.value);
                }}
                placeholder="Link to the original source (Twitter, YouTube, etc.)"
                value={sourceDraft}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>Tags</Field.Label>
              <TagInput onChange={setTagsDraft} value={tagsDraft} />
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
                  setIsEditing(false);
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
            onAddToPlaylist={
              currentUserId ? () => setShowPlaylistModal(true) : undefined
            }
            onEditClick={isOwner ? startEditing : undefined}
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

      <Comments currentUserId={currentUserId} postId={post.id} />
    </VStack>
  );
}
