import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { fetchPost } from "../utils/posts";
import { NotFound } from "~/components/NotFound";
import { PostErrorComponent } from "~/components/PostError";
import { Post } from "~/components/Post";
import { Box, Button } from "@chakra-ui/react";

export const Route = createFileRoute("/posts/$postId")({
  loader: async ({ params: { postId } }) => {
    try {
      return await fetchPost({
        data: parseInt(postId, 10),
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

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // Fallback to a specific route if no history
      navigate({ to: "/posts" });
    }
  };

  console.log({ post, user });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto rounded-lg p-6 min-w-[320px] min-h-[180px] max-w-full max-h-full">
        <Box bg={"gray.100"} shadow={"md"} borderRadius={"md"} padding={"4"}>
          <Post post={post} user={user} />
          <Button className="btn" onClick={handleBack}>
            Back
          </Button>
        </Box>
      </div>
    </div>
  );
}
