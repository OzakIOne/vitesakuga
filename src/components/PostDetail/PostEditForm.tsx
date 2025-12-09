import { Box, Button, Text } from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import type { fetchPostDetail } from "src/lib/posts/posts.fn";
import { updatePost } from "src/lib/posts/posts.fn";
import { postsKeys } from "src/lib/posts/posts.queries";
import { FormTextWrapper } from "../form/FieldText";

interface PostEditFormProps {
  post: Awaited<ReturnType<typeof fetchPostDetail>>["post"];
  initialTags: Awaited<ReturnType<typeof fetchPostDetail>>["tags"];
  onSuccess: () => void;
  onCancel: () => void;
  postId: number;
}

// TODO isDirty check so we don't lose changes accidentally

export function PostEditForm({
  post,
  initialTags,
  onSuccess,
  onCancel,
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
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    editForm.handleSubmit();
  };

  return (
    <Box shadow={"md"} borderRadius={"md"} padding={"4"} mb={4}>
      <Text fontSize="xl" fontWeight="bold" mb={4}>
        Edit Post
      </Text>
      <form onSubmit={handleSubmit}>
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

        <Box mb={4} display="flex" gap={2}>
          <Button
            type="submit"
            disabled={
              updatePostMutation.isPending || editForm.state.isSubmitting
            }
          >
            {updatePostMutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </Box>

        {updatePostMutation.isError && (
          <Text color="red.500" mb={4}>
            {updatePostMutation.error instanceof Error
              ? updatePostMutation.error.message
              : "Error updating post"}
          </Text>
        )}
      </form>
    </Box>
  );
}
