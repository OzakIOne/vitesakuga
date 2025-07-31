import { createServerFileRoute } from "@tanstack/react-start/server";
import { json } from "@tanstack/react-start";
import { kysely } from "../../auth/db/kysely";
import { DatabaseSchema } from "~/auth/db/schema/sakuga.schema";
import { userCreateSchema } from "../../utils/userSchemas";

export const ServerRoute = createServerFileRoute("/api/users").methods({
  GET: async ({ request }) => {
    console.info("Fetching users... @", request.url);
    const data = await kysely.selectFrom("users").selectAll().execute();
    console.log("api get users data", data);
    if (data.length === 0) {
      return json({ error: "No users found" }, { status: 404 });
    }
    return json(data);
  },
  POST: async ({ request }) => {
    console.info("Creating user... @", request.url);
    const data = (await request.json()) as DatabaseSchema["users"];
    console.log("api post users data", data);

    // Validate input with zod
    const parseResult = userCreateSchema.safeParse(data);
    if (!parseResult.success) {
      return json(
        { error: parseResult.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    // Check for unique email
    const existing = await kysely
      .selectFrom("user")
      .selectAll()
      .where("email", "=", data.email)
      .executeTakeFirst();
    if (existing) {
      return json({ error: "Email address already in use" }, { status: 409 });
    }

    const newUser = await kysely
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
