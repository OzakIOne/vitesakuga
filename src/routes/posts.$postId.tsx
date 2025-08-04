import { createFileRoute } from "@tanstack/react-router";
import { fetchPost } from "../utils/posts";
import { NotFound } from "~/components/NotFound";
import { PostErrorComponent } from "~/components/PostError";
import z from "zod";

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
  const post = Route.useLoaderData();
  console.log(post);
  return (
    <div className="space-y-2">
      <h4 className="text-xl font-bold underline">{post.title}</h4>
      <div className="text-sm">{post.content}</div>
    </div>
  );
}
