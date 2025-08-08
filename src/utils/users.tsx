import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { kysely } from "~/auth/db/kysely";
import { userSelectSchema } from "~/auth/db/schema";

export const DEPLOY_URL = "http://localhost:3000";

export const fetchUsers = createServerFn().handler(async () => {
  const data = await kysely.selectFrom("user").selectAll().execute();
  const parsed = z.array(userSelectSchema).safeParse(data);
  if (!parsed.success)
    throw new Error(
      `There was an error processing the search results ${parsed.error}`
    );

  return parsed.data;
});

const userIdSchema = z.coerce.string();

export const fetchUser = createServerFn()
  .validator((id: unknown) => userIdSchema.parse(id))
  .handler(async (ctx) => {
    const userInfo = await kysely
      .selectFrom("user")
      .selectAll()
      .where("id", "=", ctx.data)
      .executeTakeFirstOrThrow();

    const postsFromUser = await kysely
      .selectFrom("posts")
      .selectAll()
      .where("user_id", "=", ctx.data)
      .execute();

    return { user: userInfo, posts: postsFromUser };
  });
