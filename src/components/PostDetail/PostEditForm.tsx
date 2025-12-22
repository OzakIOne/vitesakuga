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
      content: post.content,
      relatedPostId: post.relatedPostId || undefined,
      source: post.source || undefined,
      tags: initialTags,
      title: post.title,
    },
    onSubmit: async ({ value }) => {
      if (!post.id) {
        console.error("Missing post.id");
        return;
      }

      await updatePostMutation.mutateAsync({
        content: value.content,
        postId: post.id,
        relatedPostId: value.relatedPostId || undefined,
        source: value.source || undefined,
        tags: value.tags,
        title: value.title,
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
    onError: (error) => {
      toaster.create({
        closable: true,
        description:
          error instanceof Error ? error.message : "Failed to update post",
        duration: 5000,
        title: "Error updating post",
        type: "error",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postsKeys.detail(postId) });
      toaster.create({
        closable: true,
        description: "Your post has been successfully updated.",
        duration: 3000,
        title: "Post updated",
        type: "success",
      });
      onSuccess();
    },
  });

  useBlocker({
    enableBeforeUnload: true,
    shouldBlockFn: () => {
      if (!editForm.state.isDirty) {
        return false;
      }
      // TODO replace with chakra ui thing i use
      const shouldLeave = confirm(
        "You have unsaved changes. Do you want to leave?",
      );
      return !shouldLeave;
    },
  });

  return (
    <Box borderRadius={"md"} mb={4} padding={"4"} shadow={"md"}>
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
              <FormTextWrapper field={field} isRequired label="Title" />
            </Box>
          )}
        </editForm.Field>

        <editForm.Field name="content">
          {(field) => (
            <Box mb={2}>
              <FormTextWrapper
                asTextarea
                field={field}
                isRequired
                label="Content"
              />
            </Box>
          )}
        </editForm.Field>

        <editForm.Field name="source">
          {(field) => (
            <Box mb={2}>
              <FormTextWrapper
                asTextarea
                field={field}
                helper="Link to the original source (Twitter, YouTube, etc.)"
                label="Source URL"
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
              disabled={!canSubmit || isPristine}
              loading={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          )}
        </editForm.Subscribe>
      </form>
    </Box>
  );
}
