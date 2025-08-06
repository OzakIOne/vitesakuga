import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
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
    queryFn: () => {
      const formData = new FormData();
      Object.entries(postData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // If value is a File, append as is, else convert to string
          if (value instanceof File) {
            formData.append(key, value);
          } else {
            formData.append(key, String(value));
          }
        }
      });
      return fetch(`${DEPLOY_URL}/api/posts`, {
        method: "POST",
        body: formData,
      }).then(async (r) => {
        if (!r.ok) {
          let errorData;
          try {
            errorData = await r.json();
          } catch {
            errorData = { error: await r.text() };
          }
          throw new Error(errorData.error || "Failed to upload post");
        }
        return r.json();
      });
    },
  });

const postIdSchema = z.coerce.number();

export const fetchPost = createServerFn()
  .validator((id: unknown) => postIdSchema.parse(id))
  .handler(async (ctx) => {
    const data = await kysely
      .selectFrom("posts")
      .selectAll()
      .where("id", "=", ctx.data)
      .executeTakeFirstOrThrow();

    const userPostInfo = await kysely
      .selectFrom("user")
      .select(["image", "name"])
      .where("user.id", "=", data.userId)
      .executeTakeFirstOrThrow();

    return { post: data, user: userPostInfo };
  });
