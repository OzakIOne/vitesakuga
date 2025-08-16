import { createFileRoute } from "@tanstack/react-router";
import { fetchUser } from "~/utils/users";
import { NotFound } from "~/components/NotFound";
import { UserErrorComponent } from "~/components/UserError";
import { PostList } from "~/components/PostList";
import { User } from "~/components/User";

export const Route = createFileRoute("/users/$userId")({
  loader: async ({ params: { userId } }) =>
    fetchUser({
      data: userId,
    }),
  errorComponent: UserErrorComponent,
  component: UserComponent,
  notFoundComponent: () => {
    return <NotFound>User not found</NotFound>;
  },
});

function UserComponent() {
  const data = Route.useLoaderData();
  console.log("user", data);
  return (
    <div className="p-4 space-y-6">
      {/* User Info */}
      <User user={data.user} />

      {/* Posts Grid */}
      <div className="flex flex-wrap gap-4">
        {data.posts.map((post) => (
          <div
            key={post.id}
            className="flex-1 min-w-[250px] max-w-sm border rounded-lg p-4 shadow hover:shadow-md transition"
          >
            <PostList post={post} q={undefined} pageSize={undefined} />
          </div>
        ))}
      </div>
    </div>
  );
}
