import { Box, Button, Text, Textarea } from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useState } from "react";
import { NotFound } from "src/components/NotFound";
import { Post } from "src/components/Post";
import { PostErrorComponent } from "src/components/PostError";
import { Comments } from "src/components/Comments";
import { updatePost } from "src/lib/posts/posts.fn";
import { postQueryOptions } from "src/lib/posts/posts.queries";

export const Route = createFileRoute("/posts/$postId")({
  loader: async ({ params: { postId }, context }) => {
    try {
      const id = parseInt(postId, 10);
      if (Number.isNaN(id)) {
        throw new Error("Invalid post ID");
      }
      // Seed TanStack Query cache with post data
      await context.queryClient.ensureQueryData(postQueryOptions(id));
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw new Error("not-found");
      }
      throw error;
    }
  },
  errorComponent: PostErrorComponent,
  component: PostComponent,
  notFoundComponent: () => {
    return <NotFound>Post not found</NotFound>;
  },
});

function PostComponent() {
  const { postId } = Route.useParams();
  const id = parseInt(postId, 10);

  const navigate = useNavigate();
  const context = useRouteContext({ from: "/posts/$postId" });
  const queryClient = useQueryClient();

  // Use suspense query to get post data (with cached data from loader)
  const { data: loaderData } = useSuspenseQuery(postQueryOptions(id));
  const { post, user, tags: initialTags, relatedPost } = loaderData;

  const [isEditMode, setIsEditMode] = useState(false);

  const currentUserId = context.user?.id;
  const isOwner = currentUserId === user.id;

  // Edit post form
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
      setIsEditMode(false);
      // Invalidate post query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ["posts", id] });
    },
  });

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // Fallback to a specific route if no history
      navigate({ to: "/posts" });
    }
  };

  const handleEditClick = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    editForm.reset();
  };

  return (
    <Box>
      <Box shadow={"md"} borderRadius={"md"} padding={"4"} mb={4}>
        {isEditMode && isOwner ? (
          <Box>
            <Text fontSize="xl" fontWeight="bold" mb={4}>
              Edit Post
            </Text>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                editForm.handleSubmit();
              }}
            >
              <editForm.Field name="title">
                {(field) => (
                  <Box mb={2}>
                    <Textarea
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Title"
                    />
                    {field.state.meta.errors && (
                      <Text color="red.500" fontSize="sm" mt={1}>
                        {field.state.meta.errors.join(", ")}
                      </Text>
                    )}
                  </Box>
                )}
              </editForm.Field>

              <editForm.Field name="content">
                {(field) => (
                  <Box mb={2}>
                    <Textarea
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Content"
                    />
                    {field.state.meta.errors && (
                      <Text color="red.500" fontSize="sm" mt={1}>
                        {field.state.meta.errors.join(", ")}
                      </Text>
                    )}
                  </Box>
                )}
              </editForm.Field>

              <editForm.Field name="source">
                {(field) => (
                  <Box mb={2}>
                    <Textarea
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Source URL (optional)"
                    />
                    {field.state.meta.errors && (
                      <Text color="red.500" fontSize="sm" mt={1}>
                        {field.state.meta.errors.join(", ")}
                      </Text>
                    )}
                  </Box>
                )}
              </editForm.Field>

              <Box mb={4} display="flex" gap={2}>
                <Button
                  type="submit"
                  colorScheme="green"
                  disabled={
                    updatePostMutation.isPending || editForm.state.isSubmitting
                  }
                >
                  {updatePostMutation.isPending ? "Saving..." : "Save"}
                </Button>
                <Button onClick={handleCancelEdit} colorScheme="gray">
                  Cancel
                </Button>
              </Box>

              {updatePostMutation.isError && (
                <Text color="red.600" mb={4}>
                  {updatePostMutation.error instanceof Error
                    ? updatePostMutation.error.message
                    : "Error updating post"}
                </Text>
              )}
            </form>
          </Box>
        ) : (
          <>
            <Post
              post={post}
              user={user}
              tags={initialTags}
              relatedPost={relatedPost}
              currentUserId={currentUserId}
              onEditClick={handleEditClick}
            />
            <Button onClick={handleBack} mt={4}>
              Back
            </Button>
          </>
        )}
      </Box>

      {!isEditMode && (
        <Comments postId={post.id} currentUserId={currentUserId} />
      )}
    </Box>
  );
}
