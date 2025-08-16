import { createFileRoute } from "@tanstack/react-router";
import { fetchUsers } from "../utils/users";
import { User } from "~/components/User";

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
        <User key={user.id} user={user} />
      ))}
    </div>
  );
}
