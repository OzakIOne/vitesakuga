import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { db } from "~/db/db";

export const APIRoute = createAPIFileRoute("/api/posts/$id")({
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

      return json(data);
    } catch (e) {
      console.error(e);
      return json({ error: "User not found" }, { status: 404 });
    }
  },
});
