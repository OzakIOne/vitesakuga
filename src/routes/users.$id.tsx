import { createFileRoute } from "@tanstack/react-router";
import { NotFound } from "src/components/NotFound";
import { PostList } from "src/components/PostList";
import { User } from "src/components/User";
import { UserErrorComponent } from "src/components/UserError";
import { fetchUser } from "src/lib/users/users.fn";

export const Route = createFileRoute("/users/$id")({
  loader: async ({ params: { id } }) =>
    fetchUser({
      data: id,
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
      <User name={data.user.name} image={data.user.image} id={data.user.id} />

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
