import { Link, createFileRoute } from "@tanstack/react-router";
import { postQueryOptions } from "../utils/posts";
import { NotFound } from "~/components/NotFound";
import { PostErrorComponent } from "~/components/PostError";

export const Route = createFileRoute("/posts/$postId")({
  loader: async ({ params: { postId }, context }) =>
    await context.queryClient.ensureQueryData(postQueryOptions(postId)),
  errorComponent: PostErrorComponent,
  component: PostComponent,
  notFoundComponent: () => {
    return <NotFound>Post not found</NotFound>;
  },
});

function PostComponent() {
  const post = Route.useLoaderData();

  return (
    <div className="space-y-2">
      <h4 className="text-xl font-bold underline">{post.title}</h4>
      <div className="text-sm">{post.body}</div>
    </div>
  );
}
