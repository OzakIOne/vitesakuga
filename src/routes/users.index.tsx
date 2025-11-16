import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { User } from "src/components/User";
import { usersQueryOptions } from "src/lib/users/users.queries";

export const Route = createFileRoute("/users/")({
  loader: async ({ context }) => {
    // Seed initial data into TanStack Query
    await context.queryClient.ensureQueryData(usersQueryOptions());
  },
  component: UsersLayoutComponent,
});

function UsersLayoutComponent() {
  const usersQuery = useSuspenseQuery(usersQueryOptions());

  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {usersQuery.data.map((user) => (
        <User key={user.id} name={user.name} image={user.image} id={user.id} />
      ))}
    </div>
  );
}
