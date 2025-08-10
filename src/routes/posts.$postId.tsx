import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { fetchPost } from "../utils/posts";
import { NotFound } from "~/components/NotFound";
import { PostErrorComponent } from "~/components/PostError";
import { Post } from "~/components/Post";

export const Route = createFileRoute("/posts/$postId")({
  loader: async ({ params: { postId } }) =>
    fetchPost({
      data: postId,
    }),
  // params: {
  //   parse: (params) => z.parse(z.object(postId:z.string(params.postId))),
  // },
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

  console.log(post);
  return (
    <div className="space-y-2">
      <Post post={post} user={user} />
      <button className="btn" onClick={handleBack}>
        Back
      </button>
    </div>
  );
}
