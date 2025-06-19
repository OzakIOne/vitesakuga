import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { fetchPosts } from "../utils/posts";
import { postsQueryOptions } from "../utils/posts";
import { useSuspenseQuery } from "@tanstack/react-query";
export const Route = createFileRoute("/posts")({
  loader: async ({ context }) =>
    await context.queryClient.ensureQueryData(postsQueryOptions()),
  component: PostsLayoutComponent,
});

function PostsLayoutComponent() {
  const postsQuery = useSuspenseQuery(fetchPosts);

  return (
    <div className="p-2 flex gap-2">
      <ul className="list-disc pl-4">
        {[...postsQuery.data].map((post) => {
          return (
            <li key={post.id} className="whitespace-nowrap">
              <Link
                to="/posts/$postId"
                params={{
                  postId: post.id,
                }}
                className="block py-1 text-blue-800 hover:text-blue-600"
                activeProps={{ className: "text-black font-bold" }}
              >
                <div>{post.title}</div>
              </Link>
            </li>
          );
        })}
      </ul>
      <hr />
      <Outlet />
    </div>
  );
}
