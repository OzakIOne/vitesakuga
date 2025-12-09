import { createServerFn } from "@tanstack/react-start";
import { kysely } from "src/lib/db/kysely";
import {
  createTagsForPostSchema,
  fetchPostsByTagSchema,
  getPostTagsSchema,
  searchTagsSchema,
} from "./tags.schema";

// TODO knip unused
export const searchTags = createServerFn()
  .inputValidator((input: unknown) => searchTagsSchema.parse(input))
  .handler(async ({ data }) => {
    const { query } = data;

    return await kysely
      .selectFrom("tags")
      .where("name", "ilike", `%${query}%`)
      .select(["id", "name"])
      .limit(10)
      .execute();
  });

export const getAllTags = createServerFn().handler(async () => {
  return await kysely.selectFrom("tags").select(["id", "name"]).execute();
});

export const getPostsByTag = createServerFn()
  .inputValidator((input: unknown) => fetchPostsByTagSchema.parse(input))
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

// TODO knip unused
export const createTagsForPost = createServerFn()
  .inputValidator((input: unknown) => createTagsForPostSchema.parse(input))
  .handler(async ({ data }) => {
    const { postId, tags } = data;

    // Process each tag
    const tagIds = await Promise.all(
      tags.map(async (tag) => {
        if (tag.id) {
          // Use existing tag
          return tag.id;
        } else {
          // Create new tag
          const [newTag] = await kysely
            .insertInto("tags")
            .values({ name: tag.name })
            .returning("id")
            .execute();
          return newTag.id;
        }
      }),
    );

    // Link tags to post
    await Promise.all(
      tagIds.map((tagId) =>
        kysely.insertInto("post_tags").values({ postId, tagId }).execute(),
      ),
    );

    return { success: true };
  });

// TODO knip unused
export const getPostTags = createServerFn()
  .inputValidator((input: unknown) => getPostTagsSchema.parse(input))
  .handler(async ({ data }) => {
    const { postId } = data;

    return await kysely
      .selectFrom("tags")
      .innerJoin("post_tags", "tags.id", "post_tags.tagId")
      .where("post_tags.postId", "=", postId)
      .select(["tags.id", "tags.name"])
      .execute();
  });
