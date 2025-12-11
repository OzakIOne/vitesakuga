import { createServerFn } from "@tanstack/react-start";
import { kysely } from "src/lib/db/kysely";
import { userSelectSchema } from "src/lib/db/schema";
import z from "zod";

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
  .inputValidator((user: unknown) => z.string().parse(user))
  .handler(async ({ data: userId }) => {
    const userInfo = await kysely
      .selectFrom("user")
      .select(["name", "image", "id"])
      .where("id", "=", userId)
      .executeTakeFirstOrThrow();

    if (!userInfo) throw new Error(`User ${userId} not found`);

    const postsFromUser = await kysely
      .selectFrom("posts")
      .selectAll()
      .where("userId", "=", userId)
      .execute();

    if (!postsFromUser) throw new Error(`Posts for user ${userId} not found`);

    // Calculate popular tags for this user's posts
    const popularTagsResult = await kysely
      .selectFrom("tags")
      .innerJoin("post_tags", "tags.id", "post_tags.tagId")
      .innerJoin("posts", "posts.id", "post_tags.postId")
      .where("posts.userId", "=", userId)
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
