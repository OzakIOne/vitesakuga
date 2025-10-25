import { createServerFn } from "@tanstack/react-start";
import { kysely } from "src/lib/db/kysely";
import { userSelectSchema } from "src/lib/db/schema";
import z from "zod";
import { userIdSchema } from "./users.schema";

export const DEPLOY_URL = "http://localhost:3000";

export const fetchUsers = createServerFn().handler(async () => {
  const data = await kysely.selectFrom("user").selectAll().execute();
  const parsed = z.array(userSelectSchema).safeParse(data);
  if (!parsed.success)
    throw new Error(
      `There was an error processing the search results ${parsed.error}`,
    );

  return parsed.data;
});

export const fetchUser = createServerFn()
  .inputValidator((id: unknown) => userIdSchema.parse(id))
  .handler(async (ctx) => {
    const userInfo = await kysely
      .selectFrom("user")
      .select(["name", "image", "id"])
      .where("id", "=", ctx.data)
      .executeTakeFirstOrThrow();

    if (!userInfo) throw new Error(`User ${ctx.data} not found`);

    const postsFromUser = await kysely
      .selectFrom("posts")
      .selectAll()
      .where("userId", "=", ctx.data)
      .execute();

    if (!postsFromUser) throw new Error(`Post ${ctx.data} not found`);

    return { user: userInfo, posts: postsFromUser };
  });
