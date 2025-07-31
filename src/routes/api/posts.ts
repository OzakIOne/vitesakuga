import { createServerFileRoute } from "@tanstack/react-start/server";
import { json } from "@tanstack/react-start";
import { kysely } from "../../auth/db/kysely";
import { DatabaseSchema } from "../../auth/db/schema/sakuga.schema";

export const ServerRoute = createServerFileRoute("/api/posts").methods({
  GET: async ({ request }) => {
    console.info("Fetching posts... @", request.url);
    const data = await kysely.selectFrom("posts").selectAll().execute();
    console.log({ data });
    if (data.length === 0) {
      return json({ error: "No posts found" });
    }
    return json(data);
  },
  POST: async ({ request }) => {
    console.info("Creating post... @", request.url);
    const data = (await request.json()) as DatabaseSchema["posts"];
    console.log("api post posts data", data);

    // Validate input
    if (!data.title || !data.content) {
      return json({ error: "Title and body are required" }, { status: 400 });
    }

    const newPost = await kysely
      .insertInto("posts")
      .values({
        title: data.title,
        content: data.content,
        userId: data.userId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    console.log("newpost", { newPost });
    return json(newPost);
  },
});
