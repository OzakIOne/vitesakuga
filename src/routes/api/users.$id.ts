import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { db } from "~/db/db";

export const APIRoute = createAPIFileRoute("/api/users/$id")({
  GET: async ({ request, params }) => {
    console.info(`Fetching users by id=${params.id}... @`, request.url);
    try {
      const id = Number(params.id);
      if (isNaN(id)) {
        return json({ error: "Invalid user id" }, { status: 400 });
      }
      const results = await db
        .selectFrom("users")
        .selectAll()
        .where("id", "=", id)
        .execute();

      if (results.length === 0) {
        return json({ error: "User not found" }, { status: 404 });
      }

      return json(results[0]);
    } catch (e) {
      console.error(e);
      return json({ error: "User not found" }, { status: 404 });
    }
  },
});
