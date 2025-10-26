import { createServerFn } from "@tanstack/react-start";
import { kysely } from "src/lib/db/kysely";
import { z } from "zod";
import { fetchPostsByTagSchema, searchTagsSchema } from "./tags.schema";

export const searchTags = createServerFn()
  .inputValidator((input: unknown) => searchTagsSchema.parse(input))
  .handler(async ({ data }) => {
    const { query } = data;

    const tags = await kysely
      .selectFrom("tags")
      .where("name", "ilike", `%${query}%`)
      .select(["id", "name"])
      .limit(10)
      .execute();

    return tags;
  });

export const getAllTags = createServerFn().handler(async () => {
  return await kysely.selectFrom("tags").select(["id", "name"]).execute();
});

export const fetchPostsByTag = createServerFn()
  .inputValidator((input: unknown) => fetchPostsByTagSchema.parse(input))
  .handler(async ({ data }) => {
    const { tagName } = data;

    const posts = await kysely
      .selectFrom("posts")
      .leftJoin("post_tags", "post_tags.postId", "posts.id")
      .leftJoin("tags", "tags.id", "post_tags.tagId")
      .where("tags.name", "=", tagName)
      .selectAll("posts")
      .execute();

    return posts.map((post) => ({ post }));
  });

export const createTagsForPost = createServerFn()
  .inputValidator((input: unknown) =>
    z
      .object({
        postId: z.number(),
        tags: z.array(
          z.object({
            name: z.string().min(1),
            id: z.number().optional(),
          }),
        ),
      })
      .parse(input),
  )
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

export const getPostTags = createServerFn()
  .inputValidator((input: unknown) =>
    z
      .object({
        postId: z.number(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { postId } = data;

    const tags = await kysely
      .selectFrom("tags")
      .innerJoin("post_tags", "tags.id", "post_tags.tagId")
      .where("post_tags.postId", "=", postId)
      .select(["tags.id", "tags.name"])
      .execute();

    return tags;
  });
