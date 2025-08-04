import { createServerFileRoute } from "@tanstack/react-start/server";
import { json } from "@tanstack/react-start";
import { kysely } from "../../auth/db/kysely";
import {
  DbSchemaInsert,
  postsInsertSchema,
} from "../../auth/db/schema/sakuga.schema";

export const ServerRoute = createServerFileRoute("/api/posts").methods({
  POST: async ({ request }) => {
    const data = (await request.json()) as DbSchemaInsert["posts"];
    console.log("Creating post... @", { url: request.url, data });

    const parsed = postsInsertSchema.safeParse(data);

    if (!parsed.success)
      throw new Error("There was an error processing the search results", {
        cause: parsed.error,
      });

    const newPost = await kysely
      .insertInto("posts")
      .values({ ...parsed.data })
      .returningAll()
      .executeTakeFirstOrThrow();

    console.log("Created post", { newPost });
    return json(newPost);
  },
});
