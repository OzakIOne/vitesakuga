import { Box, Button, Text, Textarea } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useState } from "react";
import { NotFound } from "src/components/NotFound";
import { Post } from "src/components/Post";
import { PostErrorComponent } from "src/components/PostError";
import { addComment, fetchComments } from "src/lib/comments/comments.fn";
import { fetchPost, updatePost } from "src/lib/posts/posts.fn";

export const Route = createFileRoute("/posts/$postId")({
  loader: async ({ params: { postId } }) => {
    try {
      const id = parseInt(postId, 10);
      if (Number.isNaN(id)) {
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
  const loaderData = Route.useLoaderData();
  const { post, user, tags: initialTags, relatedPost } = loaderData;
  const navigate = useNavigate();
  const context = useRouteContext({ from: "/posts/$postId" });

  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: post.title || "",
    content: post.content || "",
    source: post.source || "",
    relatedPostId: post.relatedPostId || undefined,
    tags: initialTags,
  });

  const currentUserId = context.user?.id;
  const isOwner = currentUserId === user.id;

  const { data: comments } = useQuery({
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
      queryClient.invalidateQueries();
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

  const handleEditClick = () => {
    setIsEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (!post.id) {
      console.error("Missing post.id");
      return;
    }

    await updatePostMutation.mutateAsync({
      postId: post.id,
      title: editFormData.title,
      content: editFormData.content,
      source: editFormData.source || undefined,
      relatedPostId: editFormData.relatedPostId || undefined,
      tags: editFormData.tags,
    });
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    // Reset form data
    setEditFormData({
      title: post.title || "",
      content: post.content || "",
      source: post.source || "",
      relatedPostId: post.relatedPostId || undefined,
      tags: initialTags,
    });
  };

  return (
    <Box>
      <Box shadow={"md"} borderRadius={"md"} padding={"4"} mb={4}>
        {isEditMode && isOwner ? (
          <Box>
            <Text fontSize="xl" fontWeight="bold" mb={4}>
              Edit Post
            </Text>
            <Textarea
              value={editFormData.title}
              onChange={(e) =>
                setEditFormData({ ...editFormData, title: e.target.value })
              }
              placeholder="Title"
              mb={2}
            />
            <Textarea
              value={editFormData.content}
              onChange={(e) =>
                setEditFormData({ ...editFormData, content: e.target.value })
              }
              placeholder="Content"
              mb={2}
            />
            <Textarea
              value={editFormData.source}
              onChange={(e) =>
                setEditFormData({ ...editFormData, source: e.target.value })
              }
              placeholder="Source URL (optional)"
              mb={2}
            />
            <Box mb={4} display="flex" gap={2}>
              <Button
                onClick={handleSaveEdit}
                colorScheme="green"
                disabled={updatePostMutation.isPending}
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
        <Box shadow={"md"} borderRadius={"md"} padding={"4"}>
          <Text fontSize="xl" fontWeight="bold" mb={4}>
            Comments
          </Text>

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
      )}
    </Box>
  );
}
