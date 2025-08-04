import { createServerFileRoute } from "@tanstack/react-start/server";
import { json } from "@tanstack/react-start";
import { kysely } from "../../auth/db/kysely";

export const ServerRoute = createServerFileRoute("/api/users/$id").methods({
  GET: async ({ request, params }) => {
    console.info(`Fetching users ...@`, { id: params.id, url: request.url });
    try {
      const userInfo = await kysely
        .selectFrom("user")
        .selectAll()
        .where("id", "=", params.id)
        .execute();

      const postsFromUser = await kysely
        .selectFrom("posts")
        .selectAll()
        .where("userId", "=", params.id)
        .execute();

      return json({ user: userInfo[0], posts: postsFromUser });
    } catch (e) {
      console.error(e);
      return json({ error: "User not found" }, { status: 404 });
    }
  },
});
