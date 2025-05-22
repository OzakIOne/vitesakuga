import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { usersQueryOptions } from "../utils/users";
import { DatabaseSchema } from "~/db/schema";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/users")({
  loader: async ({ context }) =>
    await context.queryClient.ensureQueryData(usersQueryOptions()),

  component: UsersLayoutComponent,
});

async function createUser(data: DatabaseSchema["users"]) {
  const response = await fetch("/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create user");
  }

  return response.json();
}

function UsersLayoutComponent() {
  const usersQuery = useSuspenseQuery(usersQueryOptions());

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: (data) => {
      // navigate or show success
    },
  });

  return (
    <div className="p-2 flex gap-2">
      <ul className="list-disc pl-4">
        {[
          ...usersQuery.data,
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
      <p>Create user</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          mutation.mutate({
            username: formData.get("username") as string,
            email: formData.get("email") as string,
          });
        }}
      >
        <input
          className="input"
          name="username"
          required
          placeholder="Username"
        />
        <input
          className="input"
          name="email"
          required
          placeholder="email@gmail.com"
        />
        <button className="btn" type="submit" disabled={mutation.isPending}>
          Submit
        </button>
      </form>
      <Outlet />
    </div>
  );
}
