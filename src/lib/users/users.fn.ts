import { createServerFn } from "@tanstack/react-start";
import { kysely } from "src/lib/db/kysely";
import { postsSelectSchema, userSelectSchema } from "src/lib/db/schema";
import z from "zod";
import { mapPopularTags } from "../posts/posts.utils";
import { fetchUserInputSchema } from "../users/users.schema";

export const fetchUsers = createServerFn().handler(async () => {
  const data = await kysely.selectFrom("user").selectAll().execute();
  const parsed = z.array(userSelectSchema).safeParse(data);
  if (!parsed.success) {
    throw new Error(`There was an error processing the search results ${parsed.error}`);
  }

  return parsed.data;
});

export const fetchUserPosts = createServerFn()
  .inputValidator((input: unknown) => fetchUserInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { userId, tags, q, page, pageSize } = data;
    const offset = page * pageSize;

    const userInfo = await kysely
      .selectFrom("user")
      .select(["name", "image", "id"])
      .where("id", "=", userId)
      .executeTakeFirstOrThrow();

    if (!userInfo) {
      throw new Error(`User ${userId} not found`);
    }

    // Fetch user's posts with pagination
    let query = kysely.selectFrom("posts").selectAll().where("userId", "=", userId);

    if (q) {
      query = query.where((eb) => eb("title", "ilike", `%${q}%`).or("content", "ilike", `%${q}%`));
    }

    if (tags.length > 0) {
      query = query
        .innerJoin("post_tags", "post_tags.postId", "posts.id")
        .innerJoin("tags", "tags.id", "post_tags.tagId")
        .where("tags.name", "in", tags)
        .selectAll("posts")
        .distinct();
    }

    // Get total count for pagination metadata
    const countQuery = query.clearSelect().select((eb) => eb.fn.countAll().as("count"));
    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    query = query.orderBy("id", "desc");

    // Apply offset and limit
    const items = await query.offset(offset).limit(pageSize).execute();

    const parsed = z.array(postsSelectSchema).safeParse(items);
    if (!parsed.success) {
      throw new Error(`Error processing user posts: ${parsed.error.message}`);
    }

    const posts = parsed.data;
    const hasMore = offset + pageSize < totalCount;
    const hasPrevious = offset > 0;

    // Calculate popular tags for this user's posts
    const popularTagsResult = await kysely
      .selectFrom("tags")
      .innerJoin("post_tags", "tags.id", "post_tags.tagId")
      .innerJoin("posts", "posts.id", "post_tags.postId")
      .where("posts.userId", "=", userId)
      .select(["tags.id", "tags.name", kysely.fn.count("post_tags.postId").as("postCount")])
      .groupBy(["tags.id", "tags.name"])
      .orderBy("postCount", "desc")
      .limit(10)
      .execute();

    const totalPages = Math.ceil(totalCount / pageSize);
    const currentPage = page + 1;

    return {
      data: posts,
      meta: {
        pagination: {
          currentPage,
          hasMore,
          hasPrevious,
          limit: pageSize,
          offset,
          total: totalCount,
          totalPages,
        },
        popularTags: mapPopularTags(popularTagsResult),
      },
      user: userInfo,
    };
  });
