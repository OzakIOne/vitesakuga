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
  const { post, user } = Route.useLoaderData();
  console.log(post);
  return (
    <div className="space-y-2">
      <h4 className="text-xl font-bold underline">Post title: {post.title}</h4>
      <div className="text-sm">Post content: {post.content}</div>
      <div>Posted by: {user.name}</div>
    </div>
  );
}
