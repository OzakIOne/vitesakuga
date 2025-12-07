import {
  Badge,
  Box,
  Button,
  Grid,
  GridItem,
  Heading,
  Input,
  Stack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useState } from "react";
import { Comments } from "src/components/Comments";
import { NotFound } from "src/components/NotFound";
import { Post } from "src/components/Post";
import { PostErrorComponent } from "src/components/PostError";
import { SearchBox } from "src/components/SearchBox";
import { updatePost } from "src/lib/posts/posts.fn";
import { postQueryOptions } from "src/lib/posts/posts.queries";

export const Route = createFileRoute("/posts/$postId")({
  loader: async ({ params: { postId }, context }) => {
    await context.queryClient.ensureQueryData(postQueryOptions(Number(postId)));
  },
  errorComponent: PostErrorComponent,
  component: PostComponent,
  // TODO useless?
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

  const { data: loaderData } = useSuspenseQuery(postQueryOptions(id));
  const { post, user, tags: initialTags, relatedPost } = loaderData;

  const [isEditMode, setIsEditMode] = useState(false);

  const currentUserId = context.user?.id;
  const isOwner = currentUserId === user.id;

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
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/posts" });
  };

  const handleEditClick = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    editForm.reset();
  };

  return (
    <Box p={4}>
      {isEditMode && isOwner ? (
        <Box shadow={"md"} borderRadius={"md"} padding={"4"} mb={4}>
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
                    <Text fontSize="sm" mt={1}>
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
                    <Text fontSize="sm" mt={1}>
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
                    <Text fontSize="sm" mt={1}>
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
              <Button onClick={handleCancelEdit}>Cancel</Button>
            </Box>

            {updatePostMutation.isError && (
              <Text mb={4}>
                {updatePostMutation.error instanceof Error
                  ? updatePostMutation.error.message
                  : "Error updating post"}
              </Text>
            )}
          </form>
        </Box>
      ) : (
        <>
          <Button onClick={handleBack} mb={4}>
            Back
          </Button>

          <Grid
            templateColumns={{ base: "1fr", lg: "1fr 3fr" }}
            gap={6}
            w="full"
          >
            <GridItem>
              <VStack gap={4} align="stretch">
                <Box p={4} borderRadius="md" shadow="md" border="1px">
                  <SearchBox />
                </Box>

                {initialTags && initialTags.length > 0 && (
                  <Box p={4} borderRadius="md" shadow="md" border="1px">
                    <Heading size="sm" mb={3}>
                      Tags
                    </Heading>
                    <Stack direction="row" flexWrap="wrap" gap={2}>
                      {initialTags.map((tag) => (
                        <Link
                          key={tag.id}
                          to="/posts/tags/$tag"
                          params={{ tag: tag.name }}
                        >
                          <Badge
                            px={2}
                            py={1}
                            borderRadius="full"
                            cursor="pointer"
                          >
                            {tag.name}
                          </Badge>
                        </Link>
                      ))}
                    </Stack>
                  </Box>
                )}

                <Box p={4} borderRadius="md" shadow="md" border="1px">
                  <Heading size="sm" mb={3}>
                    Statistics
                  </Heading>
                  <VStack align="stretch" gap={2}>
                    <Text fontSize="sm">
                      <strong>Post ID:</strong> {post.id}
                    </Text>
                    <Text fontSize="sm">
                      <strong>Uploaded:</strong>{" "}
                      {post.createdAt
                        ? new Date(post.createdAt).toLocaleDateString()
                        : "N/A"}
                    </Text>
                  </VStack>
                </Box>

                {relatedPost && (
                  <Box p={4} borderRadius="md" shadow="md" border="1px">
                    <Heading size="sm" mb={3}>
                      Related Post
                    </Heading>
                    <Link
                      to="/posts/$postId"
                      params={{ postId: String(relatedPost.id) }}
                    >
                      <Text fontSize="sm">{relatedPost.title}</Text>
                    </Link>
                  </Box>
                )}
              </VStack>
            </GridItem>

            <GridItem>
              <VStack gap={4} align="stretch">
                <Box p={4} borderRadius="md" shadow="md" border="1px">
                  <Post
                    post={post}
                    user={user}
                    tags={initialTags}
                    relatedPost={relatedPost}
                    currentUserId={currentUserId}
                    onEditClick={handleEditClick}
                  />
                </Box>

                <Comments postId={post.id} currentUserId={currentUserId} />
              </VStack>
            </GridItem>
          </Grid>
        </>
      )}
    </Box>
  );
}
