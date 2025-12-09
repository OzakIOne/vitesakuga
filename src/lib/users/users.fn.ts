import { createServerFn } from "@tanstack/react-start";
import { kysely } from "src/lib/db/kysely";
import { userSelectSchema } from "src/lib/db/schema";
import z from "zod";
import { userIdSchema } from "./users.schema";

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

    // Calculate popular tags for this user's posts
    const popularTagsResult = await kysely
      .selectFrom("tags")
      .innerJoin("post_tags", "tags.id", "post_tags.tagId")
      .innerJoin("posts", "posts.id", "post_tags.postId")
      .where("posts.userId", "=", ctx.data)
      .select([
        "tags.id",
        "tags.name",
        kysely.fn.count("post_tags.postId").as("postCount"),
      ])
      .groupBy(["tags.id", "tags.name"])
      .orderBy("postCount", "desc")
      .limit(10)
      .execute();

    const popularTags = popularTagsResult.map((r) => ({
      id: r.id,
      name: r.name,
      postCount: Number(r.postCount),
    }));

    return {
      user: userInfo,
      posts: postsFromUser,
      popularTags,
    };
  });
