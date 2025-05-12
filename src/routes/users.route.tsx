import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { DEPLOY_URL } from "../utils/users";
import { DatabaseSchema } from "~/db/schema";

export const Route = createFileRoute("/users")({
  loader: async () => {
    try {
      const res = await fetch(DEPLOY_URL + "/api/users");
      if (!res.ok) {
        throw new Error("Unexpected status code");
      }
      console.log("res", res);

      const data = (await res.json()) as Array<DatabaseSchema["users"]>;

      return data;
    } catch {
      throw new Error("Failed to fetch users");
    }
  },
  component: UsersLayoutComponent,
});

function UsersLayoutComponent() {
  const users = Route.useLoaderData();

  return (
    <div className="p-2 flex gap-2">
      <ul className="list-disc pl-4">
        {[
          ...users,
          {
            id: "dont exist",
            uuid: "qwe",
            username: "qwe",
            email: "string",
            createdAt: "2025",
          },
        ].map((user) => {
          return (
            <li key={user.id} className="whitespace-nowrap">
              <Link
                to="/users/$userId"
                params={{
                  userId: String(user.id),
                }}
                className="block py-1 text-blue-800 hover:text-blue-600"
                activeProps={{ className: "text-black font-bold" }}
              >
                <div>{user.username}</div>
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
