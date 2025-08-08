import { Outlet, createFileRoute } from "@tanstack/react-router";
import { fetchPosts } from "../utils/posts";
import { PostList } from "~/components/PostList";
export const Route = createFileRoute("/posts")({
  loader: async () => fetchPosts(),
  component: PostsLayoutComponent,
});

function PostsLayoutComponent() {
  const postsQuery = Route.useLoaderData();

  return (
    <div className="p-2 flex gap-2">
      <div className="flex">
        {postsQuery.map((post) => (
          <PostList post={post} />
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
