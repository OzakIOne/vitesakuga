import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "kysely";
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

export const searchPosts = createServerFn()
  .validator((person: string): string => {
    return z.string().parse(person);
  })
  .handler(async ({ data }) => {
    console.log("running server fn");

    // Strategy 1: Try exact/partial matches first
    let results = await kysely
      .selectFrom("posts")
      .selectAll()
      .where((eb) =>
        eb.or([
          // Exact word matches
          sql<boolean>`title ILIKE ${`%${data}%`}`,
          sql<boolean>`content ILIKE ${`%${data}%`}`,
          // Trigram similarity (for longer terms)
          ...(data.length >= 3
            ? [sql<boolean>`title % ${data}`, sql<boolean>`content % ${data}`]
            : []),
        ])
      )
      .orderBy(
        sql<number>`CASE
          WHEN title ILIKE ${`%${data}%`} THEN 1
          WHEN content ILIKE ${`%${data}%`} THEN 2
          ELSE 3
        END`
      )
      .orderBy(
        data.length >= 3
          ? sql<number>`GREATEST(similarity(title, ${data}), similarity(content, ${data}))`
          : sql<number>`1`,
        "desc"
      )
      .execute();

    // Strategy 2: If no results and term is short, try lowering threshold temporarily
    if (results.length === 0 && data.length <= 3) {
      results = await kysely
        .selectFrom("posts")
        .selectAll()
        .where((eb) =>
          eb.or([
            sql<boolean>`similarity(title, ${data}) > 0.1`,
            sql<boolean>`similarity(content, ${data}) > 0.1`,
          ])
        )
        .orderBy(
          sql<number>`GREATEST(similarity(title, ${data}), similarity(content, ${data})) DESC`
        )
        .execute();
    }

    const parsed = z.array(postsSelectSchema).safeParse(results);
    if (!parsed.success)
      throw new Error(
        `There was an error processing the search results ${parsed.error}`
      );

    return parsed.data;
  });

export const postsUploadOptions = (postData: Omit<PostsInsert, "key">) =>
  queryOptions({
    queryKey: ["posts", "upload", postData],
    queryFn: () => {
      const formData = new FormData();
      Object.entries(postData).forEach(([key, value]) => {
        if (value != null) {
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
