import { createServerFn } from "@tanstack/react-start";
import { kysely } from "src/lib/db/kysely";

export const getAllTags = createServerFn().handler(async () => {
  return await kysely.selectFrom("tags").select(["id", "name"]).execute();
});
