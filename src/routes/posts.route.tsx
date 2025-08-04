import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { fetchPosts } from "../utils/posts";
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
          <div key={post.id} className="p-4 flex flex-col">
            <Link to="/posts/$postId" params={{ postId: String(post.id) }}>
              <h3>{post.title}</h3>
              <div>{post.content}</div>
              <div>{new Date(post.createdAt).toDateString()}</div>
            </Link>
          </div>
        ))}
      </div>

      <hr />
      <Outlet />
    </div>
  );
}
