import { createServerFileRoute } from "@tanstack/react-start/server";
import { json } from "@tanstack/react-start";
import { kysely } from "../../auth/db/kysely";

export const ServerRoute = createServerFileRoute("/api/posts/$id").methods({
  GET: async ({ request, params }) => {
    console.info(`Fetching users by id=${params.id}... @`, request.url);
    try {
      const data = await kysely
        .selectFrom("posts")
        .selectAll()
        .where("id", "=", Number(params.id))
        .execute();

      if (!data) {
        return json({ error: "Post not found" }, { status: 404 });
      }

      return json(data[0]);
    } catch (e) {
      console.error(e);
      return json({ error: "Post not found" }, { status: 404 });
    }
  },
});
