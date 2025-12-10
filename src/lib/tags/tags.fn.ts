import { createServerFn } from "@tanstack/react-start";
import { kysely } from "src/lib/db/kysely";
import { getPostsByTagSchema } from "./tags.schema";

export const getAllTags = createServerFn().handler(async () => {
  return await kysely.selectFrom("tags").select(["id", "name"]).execute();
});

export const getPostsByTag = createServerFn()
  .inputValidator((input: unknown) => getPostsByTagSchema.parse(input))
  .handler(async ({ data }) => {
    const { tagName } = data;

    // Get posts for the specific tag
    const results = await kysely
      .selectFrom("posts")
      .leftJoin("post_tags", "post_tags.postId", "posts.id")
      .leftJoin("tags", "tags.id", "post_tags.tagId")
      .where("tags.name", "=", tagName)
      .selectAll("posts")
      .execute();

    // Calculate popular tags for posts that share the same tag
    const popularTagsResult = await kysely
      .selectFrom("tags")
      .innerJoin("post_tags", "tags.id", "post_tags.tagId")
      .innerJoin("posts", "posts.id", "post_tags.postId")
      .where("posts.id", "in", (eb) =>
        eb
          .selectFrom("posts")
          .innerJoin("post_tags", "post_tags.postId", "posts.id")
          .innerJoin("tags", "tags.id", "post_tags.tagId")
          .where("tags.name", "=", tagName)
          .select("posts.id"),
      )
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
      posts: results.map((post) => ({ post })),
      popularTags,
    };
  });
