import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { fetchPost } from "../../utils/posts";
import { NotFound } from "~/components/NotFound";
import { PostErrorComponent } from "~/components/PostError";
import { Post } from "~/components/Post";
import { Box, Button, VStack, HStack, Text, Textarea } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchComments, addComment } from "~/utils/comments";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { useRouteContext } from "@tanstack/react-router";

export const Route = createFileRoute("/posts/$postId")({
  loader: async ({ params: { postId } }) => {
    try {
      const id = parseInt(postId, 10);
      if (isNaN(id)) {
        throw new Error("Invalid post ID");
      }
      return await fetchPost({
        data: id,
      });
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
  const { post, user } = Route.useLoaderData();
  const navigate = useNavigate();
  const context = useRouteContext({ from: "/posts/$postId" });

  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  const currentUserId = context.user?.id;

  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ["comments", post.id],
    queryFn: () => fetchComments({ data: { postId: post.id || 0 } }),
    enabled: !!post.id,
  });

  const addCommentMutation = useMutation({
    mutationFn: (newComment: {
      postId: number;
      content: string;
      userId: string;
    }) => addComment({ data: newComment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", post.id] });
      setComment("");
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

  const handleSubmitComment = async () => {
    if (!comment.trim()) return;

    if (!post.id || !currentUserId) {
      console.error("Missing post.id or currentUserId");
      return;
    }

    await addCommentMutation.mutateAsync({
      postId: post.id,
      content: comment.trim(),
      userId: currentUserId,
    });
  };

  return (
    <Box>
      <Box shadow={"md"} borderRadius={"md"} padding={"4"} mb={4}>
        <Post
          post={post}
          user={user}
          tags={Route.useLoaderData().tags}
          relatedPost={Route.useLoaderData().relatedPost}
        />
        <Button onClick={handleBack} mt={4}>
          Back
        </Button>
      </Box>

      {/* Comments Section */}
      <Box shadow={"md"} borderRadius={"md"} padding={"4"}>
        <Text fontSize="xl" fontWeight="bold" mb={4}>
          Comments
        </Text>

        {/* New Comment Form */}
        <Box mb={4}>
          {currentUserId ? (
            <>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment..."
                mb={2}
              />
              <Button
                onClick={handleSubmitComment}
                disabled={addCommentMutation.isPending}
                colorScheme="blue"
              >
                {addCommentMutation.isPending ? "Adding..." : "Add Comment"}
              </Button>
            </>
          ) : (
            <Text color="gray.600" fontStyle="italic">
              You need to be logged in to write a comment.
            </Text>
          )}
        </Box>

        {/* Comments List */}
        <Box>
          {comments?.map((comment) => (
            <Box key={comment.id} p={3} borderRadius="md" shadow="sm" mb={3}>
              <Text fontSize="sm" color="gray.600" mb={1}>
                {comment.userName || "Anonymous"} •{" "}
                {comment.createdAt
                  ? new Date(comment.createdAt).toLocaleDateString()
                  : "Unknown date"}
              </Text>
              <Text>{comment.content}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
