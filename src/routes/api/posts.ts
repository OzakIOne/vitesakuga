import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { db } from "../../db/db";

export const APIRoute = createAPIFileRoute("/api/posts")({
  GET: async ({ request }) => {
    console.info("Fetching users... @", request.url);
    const data = await db.selectFrom("posts").selectAll().execute();

    return json(data);
  },
});
