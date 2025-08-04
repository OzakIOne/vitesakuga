import { queryOptions } from "@tanstack/react-query";
import z from "zod";
import { postsSelectSchema, userSelectSchema } from "~/auth/db/schema";

export const DEPLOY_URL = "http://localhost:3000";

export const userQueryOptions = () =>
  queryOptions({
    queryKey: ["user"],
    queryFn: () =>
      fetch(`${DEPLOY_URL}/api/users`)
        .then(async (r) => {
          console.log("Debug 1");

          if (!r.ok) {
            throw new Error("Failed to fetch users");
          }
          const data = await r.json();

          console.log("debug 2", data);
          const parsed = z.array(userSelectSchema).safeParse(data);
          if (!parsed.success)
            throw new Error(
              "There was an error processing the search results",
              {
                cause: parsed.error,
              }
            );
          console.log("Api users", parsed.data);

          return parsed.data;
        })
        .catch(() => {
          throw new Error("Failed to fetch users");
        }),
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
