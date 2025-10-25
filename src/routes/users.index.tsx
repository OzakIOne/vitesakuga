import { createFileRoute } from "@tanstack/react-router";
import { User } from "src/components/User";
import { fetchUsers } from "src/lib/users/users.fn";

export const Route = createFileRoute("/users/")({
  loader: async () => fetchUsers(),
  component: UsersLayoutComponent,
});

function UsersLayoutComponent() {
  const usersQuery = Route.useLoaderData();
  console.log("Component users", usersQuery);
  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {usersQuery.map((user) => (
        <User key={user.id} name={user.name} image={user.image} id={user.id} />
      ))}
    </div>
  );
}
