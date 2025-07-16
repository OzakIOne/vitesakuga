import { createServerFileRoute } from "@tanstack/react-start/server";
import { json } from "@tanstack/react-start";
import { db } from "~/db/db";

export const ServerRoute = createServerFileRoute("/api/posts/$id").methods({
  GET: async ({ request, params }) => {
    console.info(`Fetching users by id=${params.id}... @`, request.url);
    try {
      const id = Number(params.id);
      if (isNaN(id)) {
        return json({ error: "Invalid user id" }, { status: 400 });
      }
      const data = await db
        .selectFrom("posts")
        .selectAll()
        .where("id", "=", id)
        .execute();

      return json(data[0]);
    } catch (e) {
      console.error(e);
      return json({ error: "Post not found" }, { status: 404 });
    }
  },
});
