import { Box, Button, Text } from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import type { fetchPostDetail } from "src/lib/posts/posts.fn";
import { updatePost } from "src/lib/posts/posts.fn";
import { postsKeys } from "src/lib/posts/posts.queries";
import { FormTextWrapper } from "../form/FieldText";
import { toaster } from "../ui/toaster";

type PostEditFormProps = {
  post: Awaited<ReturnType<typeof fetchPostDetail>>["post"];
  initialTags: Awaited<ReturnType<typeof fetchPostDetail>>["tags"];
  onSuccess: () => void;
  onCancel: () => void;
  postId: number;
};

export function PostEditForm({
  post,
  initialTags,
  onSuccess,
  postId,
}: PostEditFormProps) {
  const queryClient = useQueryClient();

  const editForm = useForm({
    defaultValues: {
      title: post.title,
      content: post.content,
      source: post.source || undefined,
      relatedPostId: post.relatedPostId || undefined,
      tags: initialTags,
    },
    onSubmit: async ({ value }) => {
      if (!post.id) {
        console.error("Missing post.id");
        return;
      }

      await updatePostMutation.mutateAsync({
        postId: post.id,
        title: value.title,
        content: value.content,
        source: value.source || undefined,
        relatedPostId: value.relatedPostId || undefined,
        tags: value.tags,
      });
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: async (data: {
      postId: number;
      title: string;
      content: string;
      source?: string;
      relatedPostId?: number;
      tags: { id?: number; name: string }[];
    }) => updatePost({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postsKeys.detail(postId) });
      toaster.create({
        type: "success",
        title: "Post updated",
        description: "Your post has been successfully updated.",
        duration: 3000,
        closable: true,
      });
      onSuccess();
    },
    onError: (error) => {
      toaster.create({
        type: "error",
        title: "Error updating post",
        description:
          error instanceof Error ? error.message : "Failed to update post",
        duration: 5000,
        closable: true,
      });
    },
  });

  useBlocker({
    shouldBlockFn: () => {
      if (!editForm.state.isDirty) return false;

      const shouldLeave = confirm(
        "You have unsaved changes. Do you want to leave?",
      );
      return !shouldLeave;
    },
    enableBeforeUnload: true,
  });

  return (
    <Box shadow={"md"} borderRadius={"md"} padding={"4"} mb={4}>
      <Text fontSize="xl" fontWeight="bold" mb={4}>
        Edit Post
      </Text>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          editForm.handleSubmit();
        }}
      >
        <editForm.Field name="title">
          {(field) => (
            <Box mb={2}>
              <FormTextWrapper label="Title" field={field} isRequired />
            </Box>
          )}
        </editForm.Field>

        <editForm.Field name="content">
          {(field) => (
            <Box mb={2}>
              <FormTextWrapper
                label="Content"
                field={field}
                isRequired
                asTextarea
              />
            </Box>
          )}
        </editForm.Field>

        <editForm.Field name="source">
          {(field) => (
            <Box mb={2}>
              <FormTextWrapper
                label="Source URL"
                field={field}
                asTextarea
                helper="Link to the original source (Twitter, YouTube, etc.)"
              />
            </Box>
          )}
        </editForm.Field>

        <editForm.Subscribe
          selector={(state) => [
            state.canSubmit,
            state.isSubmitting,
            state.isPristine,
          ]}
        >
          {([canSubmit, isSubmitting, isPristine]) => (
            <Button
              type="submit"
              disabled={!canSubmit || isPristine}
              loading={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          )}
        </editForm.Subscribe>
      </form>
    </Box>
  );
}
