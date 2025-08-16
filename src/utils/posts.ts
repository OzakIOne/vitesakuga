import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { kysely } from "~/auth/db/kysely";
import { postsSelectSchema, DbSchemaSelect } from "~/auth/db/schema";
import { queryOptions } from "@tanstack/react-query";
import { DEPLOY_URL } from "./users";

// Schema for pagination parameters following JSON:API cursor pagination profile
const fetchPostsInputSchema = z.object({
  page: z
    .object({
      size: z.number().min(1).max(100).default(20), // page[size]
      after: z.number().optional(), // page[after] - cursor for next page
      before: z.number().optional(), // page[before] - cursor for previous page
    })
    .optional()
    .default({ size: 20 }),
});

const paginatedPostsResponseSchema = z.object({
  data: z.array(postsSelectSchema), // Primary data
  links: z.object({
    self: z.string(),
    next: z.string().nullable(),
  }),
  meta: z.object({
    hasMore: z.boolean(),
    cursors: z.object({
      after: z.number().nullable(),
    }),
  }),
});

export type PaginatedPostsResponse = z.infer<
  typeof paginatedPostsResponseSchema
>;

export const fetchPosts = createServerFn()
  .validator((input: unknown) => fetchPostsInputSchema.parse(input))
  .handler(async ({ data }): Promise<PaginatedPostsResponse> => {
    const { page } = data;
    const { size, after } = page;

    // Simple cursor-based query - only handle 'after' for infinite scrolling
    let query = kysely.selectFrom("posts").selectAll().orderBy("id", "desc"); // Newest first

    // If we have a cursor, get posts older than this ID
    if (after) {
      query = query.where("id", "<", after);
    }

    // Fetch one extra item to check if there are more pages
    const items = await query.limit(size + 1).execute();

    const parsed = z.array(postsSelectSchema).safeParse(items);
    if (!parsed.success) {
      throw new Error(`Error processing posts: ${parsed.error.message}`);
    }

    const posts = parsed.data;
    const hasMore = posts.length > size;

    // Remove extra item if present
    const datas = hasMore ? posts.slice(0, size) : posts;

    // Set cursors
    const afterCursor = datas.length > 0 ? datas[datas.length - 1].id : null;

    return {
      data: datas,
      links: {
        self: after
          ? `/api/posts?page[after]=${after}&page[size]=${size}`
          : `/api/posts?page[size]=${size}`,
        next:
          hasMore && afterCursor
            ? `/api/posts?page[after]=${afterCursor}&page[size]=${size}`
            : null,
      },
      meta: {
        hasMore,
        cursors: {
          after: afterCursor,
        },
      },
    };
  });

export const searchPosts = createServerFn()
  .validator((input: unknown) =>
    z
      .object({
        q: z.string().trim().min(1),
        page: z
          .object({
            size: z.number().min(1).max(100).default(20),
            after: z.number().optional(),
          })
          .optional()
          .default({ size: 20 }),
      })
      .parse(input)
  )
  .handler(async ({ data }): Promise<PaginatedPostsResponse> => {
    const { q, page } = data;
    const { size, after } = page;

    let query = kysely
      .selectFrom("posts")
      .selectAll()
      .where((eb) =>
        eb("title", "ilike", `%${q}%`).or("content", "ilike", `%${q}%`)
      )
      .orderBy("id", "desc");

    // Apply cursor for forward pagination
    if (after) {
      query = query.where("id", "<", after);
    }

    const items = await query.limit(size + 1).execute();

    const parsed = z.array(postsSelectSchema).safeParse(items);
    if (!parsed.success) {
      throw new Error(
        `Error processing search results: ${parsed.error.message}`
      );
    }

    const posts = parsed.data;
    const hasMore = posts.length > size;

    // Remove extra item if present
    const datas = hasMore ? posts.slice(0, size) : posts;

    // Set cursors
    const afterCursor = datas.length > 0 ? datas[datas.length - 1].id : null;

    return {
      data: datas,
      links: {
        self: after
          ? `/api/posts/search?q=${encodeURIComponent(
              q
            )}&page[after]=${after}&page[size]=${size}`
          : `/api/posts/search?q=${encodeURIComponent(q)}&page[size]=${size}`,
        next:
          hasMore && afterCursor
            ? `/api/posts/search?q=${encodeURIComponent(
                q
              )}&page[after]=${afterCursor}&page[size]=${size}`
            : null,
      },
      meta: {
        hasMore,
        cursors: {
          after: afterCursor,
        },
      },
    };
  });

const postIdSchema = z.coerce.number();

export const fetchPost = createServerFn()
  .validator((id: unknown) => postIdSchema.parse(id))
  .handler(async (ctx) => {
    const post = await kysely
      .selectFrom("posts")
      .selectAll()
      .where("id", "=", ctx.data)
      .executeTakeFirst();

    if (!post) throw new Error(`Post ${ctx.data} not found`);

    const user = await kysely
      .selectFrom("user")
      .select(["image", "name"])
      .where("user.id", "=", post.userId)
      .executeTakeFirst();

    // ? useless? post must always be bind to a user so if a post is found then there is a user bind to it
    if (!user) throw new Error(`User not found`);

    return { post, user };
  });

export const postsUploadOptions = (postData: DbSchemaSelect["posts"]) =>
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
