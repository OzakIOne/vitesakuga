import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { db } from "../../db/db";
import { DatabaseSchema } from "~/db/schema";

export const APIRoute = createAPIFileRoute("/api/posts")({
  GET: async ({ request }) => {
    console.info("Fetching posts... @", request.url);
    const data = await db.selectFrom("posts").selectAll().execute();
    return json(data);
  },
  POST: async ({ request }) => {
    console.info("Creating post... @", request.url);
    const data = (await request.json()) as DatabaseSchema["posts"];
    console.log("api post posts data", data);

    // Validate input
    if (!data.title || !data.body) {
      return json({ error: "Title and body are required" }, { status: 400 });
    }

    const newPost = await db
      .insertInto("posts")
      .values({
        title: data.title,
        content: data.content,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return json(newPost);
  },
});
