import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { kysely } from "~/auth/db/kysely";
import { postsSelectSchema, userSelectSchema } from "~/auth/db/schema";

export const DEPLOY_URL = "http://localhost:3000";

export const fetchUsers = createServerFn().handler(async (ctx) => {
  const data = await kysely.selectFrom("user").selectAll().execute();
  const parsed = z.array(userSelectSchema).safeParse(data);
  if (!parsed.success)
    throw new Error(
      `There was an error processing the search results ${parsed.error}`
    );

  return parsed.data;
});

export const userIdQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["user", id],
    queryFn: () =>
      fetch(`${DEPLOY_URL}/api/users/${id}`)
        .then(async (r) => {
          if (!r.ok) {
            throw new Error("Failed to fetch users");
          }
          const data = await r.json();
          console.log("Api user id data", data);
          const userIdSchema = z.object({
            user: userSelectSchema,
            posts: z.array(postsSelectSchema),
          });
          const parsed = userIdSchema.safeParse(data);
          if (!parsed.success)
            throw new Error(
              "There was an error processing the search results",
              {
                cause: parsed.error,
              }
            );
          return parsed.data;
        })
        .catch(() => {
          throw new Error("Failed to fetch users");
        }),
  });

const userIdSchema = z.coerce.string();

export const fetchUser = createServerFn()
  .validator((id: unknown) => userIdSchema.parse(id))
  .handler(async (ctx) => {
    const userInfo = await kysely
      .selectFrom("user")
      .selectAll()
      .where("id", "=", ctx.data)
      .execute();

    const postsFromUser = await kysely
      .selectFrom("posts")
      .selectAll()
      .where("userId", "=", ctx.data)
      .execute();

    return { user: userInfo[0], posts: postsFromUser };
  });
