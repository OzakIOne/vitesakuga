import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "src/components/EmptyState";
import { CardGridSkeleton } from "src/components/LoadingSkeletons";
import { Heading } from "src/components/ui/typography";
import { User } from "src/components/User";
import { fetchUsers } from "src/lib/users/users.service";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/users/")({
  component: UsersContent,
  loader: async () => ({ users: await fetchUsers() }),
  pendingComponent: () => <CardGridSkeleton count={8} />,
  head: () => ({
    meta: seo({
      title: "Contributors · ViteSakuga",
      description: "Browse the contributors who build the ViteSakuga archive.",
    }),
  }),
});

function UsersContent() {
  const { users } = Route.useLoaderData();

  return (
    <div className="p-4">
      <Heading as="h1" className="mb-6" size="2xl">
        Contributors
      </Heading>
      {users.length === 0 ? (
        <EmptyState
          description="Contributor profiles will appear after members join."
          title="No contributors yet"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {users.map((user) => (
            <User
              id={user.id}
              image={user.image}
              key={user.id}
              name={user.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}
