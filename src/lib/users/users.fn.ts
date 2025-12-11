import { createServerFn } from "@tanstack/react-start";
import { kysely } from "src/lib/db/kysely";
import { postsSelectSchema, userSelectSchema } from "src/lib/db/schema";
import z from "zod";

const fetchUserInputSchema = z.object({
  userId: z.string(),
  page: z
    .object({
      size: z.number().min(1).max(100).default(20),
      after: z.number().optional(),
    })
    .optional()
    .default({ size: 20 }),
});

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
  .inputValidator((input: unknown) => fetchUserInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { userId, page } = data;
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
      .where("userId", "=", userId)
      .orderBy("id", "desc");

    // Apply cursor for forward pagination
    if (after) {
      query = query.where("id", "<", after);
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

    const popularTags = popularTagsResult.map((r) => ({
      id: r.id,
      name: r.name,
      postCount: Number(r.postCount),
    }));

    return {
      user: userInfo,
      data: postsData,
      links: {
        self: after
          ? `/users/${userId}?page[after]=${after}&page[size]=${size}`
          : `/users/${userId}?page[size]=${size}`,
        next:
          hasMore && afterCursor
            ? `/users/${userId}?page[after]=${afterCursor}&page[size]=${size}`
            : null,
      },
      meta: {
        hasMore,
        cursors: {
          after: afterCursor,
        },
        popularTags,
      },
    };
  });
