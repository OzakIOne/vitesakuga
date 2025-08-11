import { Outlet, createFileRoute } from "@tanstack/react-router";
import { fetchPosts, searchPosts } from "../utils/posts";
import { PostList } from "~/components/PostList";
import z from "zod";

const searchSchema = z.object({
  q: z.string().trim().min(1).optional(),
});

export const Route = createFileRoute("/posts")({
  validateSearch: searchSchema,
  loaderDeps: ({ search: { q } }) => ({ q }),
  loader: async ({ deps: { q } }) => {
    if (q) {
      return await searchPosts({ data: q });
    }
    return await fetchPosts();
  },
  component: PostsLayoutComponent,
  staleTime: 60 * 1000,
});

function PostsLayoutComponent() {
  const posts = Route.useLoaderData();
  return (
    <div className="p-2 flex gap-2">
      <div className="flex">
        {posts.map((post) => (
          <PostList key={post.id} post={post} />
        ))}
      </div>
      <hr />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto bg-base-100 rounded-lg p-6 min-w-[320px] min-h-[180px] max-w-full max-h-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
