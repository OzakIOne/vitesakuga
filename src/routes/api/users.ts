import { createServerFileRoute } from "@tanstack/react-start/server";
import { json } from "@tanstack/react-start";
import { kysely } from "../../auth/db/kysely";

export const ServerRoute = createServerFileRoute("/api/users").methods({
  GET: async ({ request }) => {
    console.log("GET DEBUG FDP");
    const data = await kysely.selectFrom("user").selectAll().execute();
    console.info("Fetching users... @", { url: request.url, data });

    return json(data);
  },
});
