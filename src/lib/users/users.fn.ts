import { createServerFn } from "@tanstack/react-start";
import { kysely } from "src/lib/db/kysely";
import { postsSelectSchema, userSelectSchema } from "src/lib/db/schema";
import z from "zod";
import { mapPopularTags } from "../posts/posts.utils";
import { fetchUserInputSchema } from "../users/users.schema";

export const fetchUsers = createServerFn().handler(async () => {
  const data = await kysely.selectFrom("user").selectAll().execute();
  const parsed = z.array(userSelectSchema).safeParse(data);
  if (!parsed.success)
    throw new Error(
      `There was an error processing the search results ${parsed.error}`,
    );

  return parsed.data;
});

export const fetchUserPosts = createServerFn()
  .inputValidator((input: unknown) => fetchUserInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { userId, tags, q, page } = data;
    const { size, after } = page;

    const userInfo = await kysely
      .selectFrom("user")
      .select(["name", "image", "id"])
      .where("id", "=", userId)
      .executeTakeFirstOrThrow();

    if (!userInfo) throw new Error(`User ${userId} not found`);

    // Fetch user's posts with pagination
    let query = kysely
      .selectFrom("posts")
      .selectAll()
      .where("userId", "=", userId);

    if (q) {
      query = query.where((eb) =>
        eb("title", "ilike", `%${q}%`).or("content", "ilike", `%${q}%`),
      );
    }

    if (tags.length > 0) {
      query = query
        .innerJoin("post_tags", "post_tags.postId", "posts.id")
        .innerJoin("tags", "tags.id", "post_tags.tagId")
        .where("tags.name", "in", tags)
        .selectAll("posts")
        .distinct();
    }

    query = query.orderBy("id", "desc");

    // Apply cursor for forward pagination
    if (after) {
      query = query.where("posts.id", "<", after);
    }

    const items = await query.limit(size + 1).execute();

    const parsed = z.array(postsSelectSchema).safeParse(items);
    if (!parsed.success) {
      throw new Error(`Error processing user posts: ${parsed.error.message}`);
    }

    const posts = parsed.data;
    const hasMore = posts.length > size;

    // Remove extra item if present
    const postsData = hasMore ? posts.slice(0, size) : posts;

    // Set cursors
    const afterCursor =
      postsData.length > 0 ? postsData[postsData.length - 1].id : null;

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

    return {
      data: postsData,
      links: {
        next:
          hasMore && afterCursor
            ? `/users/${userId}?page[after]=${afterCursor}&page[size]=${size}`
            : null,
        self: after
          ? `/users/${userId}?page[after]=${after}&page[size]=${size}`
          : `/users/${userId}?page[size]=${size}`,
      },
      meta: {
        cursors: {
          after: afterCursor,
        },
        hasMore,
        popularTags: mapPopularTags(popularTagsResult),
      },
      user: userInfo,
    };
  });
