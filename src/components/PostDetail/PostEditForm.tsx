import { Box, Button, Text } from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { updatePost } from "src/lib/posts/posts.fn";
import type { fetchPost } from "src/lib/posts/posts.fn";

interface PostEditFormProps {
  post: Awaited<ReturnType<typeof fetchPost>>["post"];
  initialTags: Awaited<ReturnType<typeof fetchPost>>["tags"];
  onSuccess: () => void;
  onCancel: () => void;
  postId: number;
}

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
      title: post.title || "",
      content: post.content || "",
      source: post.source || "",
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
      // Invalidate post query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ["posts", postId] });
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
        <editForm.Field
          name={"title" as const}
        >
          {(field) => (
            <Box mb={2}>
              <Text fontWeight="bold" mb={1}>Title</Text>
              <textarea
                value={String(field.state.value ?? "")}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Title"
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  fontFamily: "inherit",
                }}
              />
              {field.state.meta.errors && (
                <Text fontSize="sm" color="red.500" mt={1}>
                  {field.state.meta.errors.join(", ")}
                </Text>
              )}
            </Box>
          )}
        </editForm.Field>

        <editForm.Field
          name={"content" as const}
        >
          {(field) => (
            <Box mb={2}>
              <Text fontWeight="bold" mb={1}>Content</Text>
              <textarea
                value={String(field.state.value ?? "")}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Content"
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  fontFamily: "inherit",
                  minHeight: "100px",
                }}
              />
              {field.state.meta.errors && (
                <Text fontSize="sm" color="red.500" mt={1}>
                  {field.state.meta.errors.join(", ")}
                </Text>
              )}
            </Box>
          )}
        </editForm.Field>

        <editForm.Field
          name={"source" as const}
        >
          {(field) => (
            <Box mb={2}>
              <Text fontWeight="bold" mb={1}>Source URL (optional)</Text>
              <textarea
                value={String(field.state.value ?? "")}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Source URL (optional)"
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  fontFamily: "inherit",
                }}
              />
              {field.state.meta.errors && (
                <Text fontSize="sm" color="red.500" mt={1}>
                  {field.state.meta.errors.join(", ")}
                </Text>
              )}
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
