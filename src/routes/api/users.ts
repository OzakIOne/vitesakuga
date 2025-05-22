import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { db } from "../../db/db";
import { DatabaseSchema } from "~/db/schema";

export const APIRoute = createAPIFileRoute("/api/users")({
  GET: async ({ request }) => {
    console.info("Fetching users... @", request.url);
    const data = await db.selectFrom("users").selectAll().execute();
    console.log("api get users data", data);

    return json(data);
  },
  POST: async ({ request }) => {
    console.info("Creating user... @", request.url);
    const data = (await request.json()) as DatabaseSchema["users"];
    console.log("api post users data", data);

    const newUser = await db
      .insertInto("users")
      .values({
        username: data.username,
        email: data.email,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return json(newUser);
  },
});
