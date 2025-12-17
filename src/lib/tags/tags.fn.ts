import { createServerFn } from "@tanstack/react-start";
import { kysely } from "src/lib/db/kysely";
import { mapPopularTags } from "../posts/posts.utils";

export const getAllTags = createServerFn().handler(async () => {
  return await kysely.selectFrom("tags").select(["id", "name"]).execute();
});

export const getAllPopularTags = createServerFn().handler(async () => {
  const popularTagsResult = await kysely
    .selectFrom("tags")
    .select(["tags.id", "tags.name"])
    .leftJoin("post_tags", "tags.id", "post_tags.tagId")
    .select(kysely.fn.count("post_tags.postId").as("postCount"))
    .groupBy(["tags.id", "tags.name"])
    .orderBy("postCount", "desc")
    .limit(10)
    .execute();

  return mapPopularTags(popularTagsResult);
});
