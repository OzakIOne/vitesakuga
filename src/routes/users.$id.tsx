import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { NotFound } from "src/components/NotFound";
import { PostList } from "src/components/PostList";
import { User } from "src/components/User";
import { UserErrorComponent } from "src/components/UserError";
import { userQueryOptions } from "src/lib/users/users.queries";

export const Route = createFileRoute("/users/$id")({
  loader: async ({ params: { id }, context }) => {
    await context.queryClient.ensureQueryData(userQueryOptions(id));
  },
  errorComponent: UserErrorComponent,
  component: UserComponent,
  notFoundComponent: () => {
    return <NotFound>User not found</NotFound>;
  },
});

function UserComponent() {
  const { id } = Route.useParams();
  const data = useSuspenseQuery(userQueryOptions(id));

  return (
    <div className="p-4 space-y-6">
      <User
        name={data.data.user.name}
        image={data.data.user.image}
        id={data.data.user.id}
      />

      <div className="flex flex-wrap gap-4">
        {data.data.posts.map((post) => (
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
