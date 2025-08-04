import { queryOptions } from "@tanstack/react-query";
import { createServerFn, json } from "@tanstack/react-start";
import z from "zod";
import { kysely } from "~/auth/db/kysely";
import { PostsInsert, postsSelectSchema } from "~/auth/db/schema";

export const DEPLOY_URL = import.meta.env.VITE_BASE_URL || "";

export const fetchPosts = createServerFn().handler(async () => {
  const data = await kysely.selectFrom("posts").selectAll().execute();

  const parsed = z.array(postsSelectSchema).safeParse(data);
  if (!parsed.success)
    throw new Error(
      `There was an error processing the search results ${parsed.error}`
    );

  return parsed.data;
});

export const postsUploadOptions = (postData: PostsInsert) =>
  queryOptions({
    queryKey: ["posts", "upload", postData],
    queryFn: () =>
      fetch(`${DEPLOY_URL}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postData),
      }).then(async (r) => {
        if (!r.ok) {
          const errorData = await r.json();
          throw new Error(errorData.error || "Failed to upload post");
        }
        return r.json();
      }),
  });

const postIdSchema = z.coerce.number();

export const fetchPost = createServerFn()
  .validator((id: unknown) => postIdSchema.parse(id))
  .handler(async (ctx) => {
    const data = await kysely
      .selectFrom("posts")
      .selectAll()
      .where("id", "=", ctx.data)
      .execute();

    return data[0];
  });
