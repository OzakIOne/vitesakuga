import { createFileRoute } from "@tanstack/react-router";
import { DEPLOY_URL } from "~/utils/users";
import { NotFound } from "~/components/NotFound";
import { UserErrorComponent } from "~/components/UserError";
import { DatabaseSchema } from "~/db/schema";

export const Route = createFileRoute("/users/$userId")({
  loader: async ({ params: { userId } }) => {
    try {
      const res = await fetch(`${DEPLOY_URL}/api/users/${userId}`);
      if (!res.ok) {
        throw new Error("Unexpected status code");
      }

      return (await res.json()) as DatabaseSchema["users"];
    } catch {
      throw new Error("Failed to fetch user");
    }
  },
  errorComponent: UserErrorComponent,
  component: UserComponent,
  notFoundComponent: () => {
    return <NotFound>User not found</NotFound>;
  },
});

function UserComponent() {
  const user = Route.useLoaderData();
  console.log("user", user);
  return (
    <div className="space-y-2">
      <h4 className="text-xl font-bold underline">{user.username}</h4>
      <div className="text-sm">{user.email}</div>
    </div>
  );
}
