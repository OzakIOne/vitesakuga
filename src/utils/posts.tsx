import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { kysely } from "~/auth/db/kysely";
import { PostsInsert, postsSelectSchema } from "~/auth/db/schema";
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

// Response schema following JSON:API structure
const paginatedPostsResponseSchema = z.object({
  data: z.array(postsSelectSchema), // Primary data
  links: z.object({
    self: z.string(),
    first: z.string().nullable(),
    last: z.string().nullable(),
    prev: z.string().nullable(),
    next: z.string().nullable(),
  }),
  meta: z.object({
    total: z.number().optional(), // Optional total count
    hasMore: z.boolean(),
    cursors: z.object({
      before: z.number().nullable(),
      after: z.number().nullable(),
    }),
  }),
});

type FetchPostsInput = z.infer<typeof fetchPostsInputSchema>;
type PaginatedPostsResponse = z.infer<typeof paginatedPostsResponseSchema>;

export const fetchPosts = createServerFn()
  .validator((input: unknown) => fetchPostsInputSchema.parse(input))
  .handler(async ({ data }): Promise<PaginatedPostsResponse> => {
    const { page } = data;
    const { size, after, before } = page;

    // Build the base query
    let query = kysely.selectFrom("posts").selectAll().orderBy("id", "desc");

    // Apply cursor conditions
    if (after && before) {
      // Between cursors (exclusive)
      query = query.where("id", "<", after).where("id", ">", before);
    } else if (after) {
      // After cursor (next page)
      query = query.where("id", "<", after);
    } else if (before) {
      // Before cursor (previous page) - reverse order to get items before
      query = query.where("id", ">", before).orderBy("id", "asc");
    }

    // Fetch one extra item to determine if there are more pages
    const dataResult = await query.limit(size + 1).execute();

    const parsed = z.array(postsSelectSchema).safeParse(dataResult);
    if (!parsed.success) {
      throw new Error(
        `There was an error processing the posts: ${parsed.error.message}`
      );
    }

    let items = parsed.data;

    // If we queried before a cursor, we need to reverse the results back to desc order
    if (before && !after) {
      items = items.reverse();
    }

    // Determine if there are more pages
    const hasMore = items.length > size;
    if (hasMore) {
      items = items.slice(0, size); // Remove the extra item
    }

    // Determine cursors
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    const beforeCursor = firstItem?.id || null;
    const afterCursor = lastItem?.id || null;

    // Build pagination links
    const baseUrl = "/api/posts"; // You should get this from request context
    const buildUrl = (params: Record<string, any>) => {
      const searchParams = new URLSearchParams();
      searchParams.set("page[size]", size.toString());

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, value.toString());
        }
      });

      return `${baseUrl}?${searchParams.toString()}`;
    };

    // Determine if there are previous/next pages
    const hasPrevious = !!before || (!!after && items.length > 0);
    const hasNext = hasMore || (!!before && items.length > 0);

    const links = {
      self: after
        ? buildUrl({ "page[after]": after })
        : before
        ? buildUrl({ "page[before]": before })
        : buildUrl({}),
      first: buildUrl({}), // First page has no cursor parameters
      last: null, // Last page is hard to determine with cursor pagination
      prev:
        hasPrevious && beforeCursor
          ? buildUrl({ "page[before]": beforeCursor })
          : null,
      next:
        hasNext && afterCursor
          ? buildUrl({ "page[after]": afterCursor })
          : null,
    };

    return {
      data: items,
      links,
      meta: {
        hasMore,
        cursors: {
          before: beforeCursor,
          after: afterCursor,
        },
      },
    };
  });

// Updated search function to also follow JSON:API structure
export const searchPosts = createServerFn()
  .validator((input: unknown) =>
    z
      .object({
        q: z.string().trim().min(1),
        page: z
          .object({
            size: z.number().min(1).max(100).default(20),
            after: z.number().optional(),
            before: z.number().optional(),
          })
          .optional()
          .default({ size: 20 }),
      })
      .parse(input)
  )
  .handler(async ({ data }): Promise<PaginatedPostsResponse> => {
    const { q, page } = data;
    const { size, after, before } = page;

    let query = kysely
      .selectFrom("posts")
      .selectAll()
      .where((eb) =>
        eb("title", "ilike", `%${q}%`).or("content", "ilike", `%${q}%`)
      )
      .orderBy("id", "desc");

    // Apply cursor logic similar to fetchPosts
    if (after && before) {
      query = query.where("id", "<", after).where("id", ">", before);
    } else if (after) {
      query = query.where("id", "<", after);
    } else if (before) {
      query = query.where("id", ">", before).orderBy("id", "asc");
    }

    const dataResult = await query.limit(size + 1).execute();

    const parsed = z.array(postsSelectSchema).safeParse(dataResult);
    if (!parsed.success) {
      throw new Error(
        `There was an error processing search results: ${parsed.error.message}`
      );
    }

    let items = parsed.data;

    if (before && !after) {
      items = items.reverse();
    }

    const hasMore = items.length > size;
    if (hasMore) {
      items = items.slice(0, size);
    }

    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    const beforeCursor = firstItem?.id || null;
    const afterCursor = lastItem?.id || null;

    const baseUrl = "/api/posts/search";
    const buildUrl = (params: Record<string, any>) => {
      const searchParams = new URLSearchParams();
      searchParams.set("q", q);
      searchParams.set("page[size]", size.toString());

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, value.toString());
        }
      });

      return `${baseUrl}?${searchParams.toString()}`;
    };

    const hasPrevious = !!before || (!!after && items.length > 0);
    const hasNext = hasMore || (!!before && items.length > 0);

    return {
      data: items,
      links: {
        self: buildUrl(
          after
            ? { "page[after]": after }
            : before
            ? { "page[before]": before }
            : {}
        ),
        first: buildUrl({}),
        last: null,
        prev:
          hasPrevious && beforeCursor
            ? buildUrl({ "page[before]": beforeCursor })
            : null,
        next:
          hasNext && afterCursor
            ? buildUrl({ "page[after]": afterCursor })
            : null,
      },
      meta: {
        hasMore,
        cursors: {
          before: beforeCursor,
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

    if (!post) {
      throw new Error(`Post ${ctx.data} not found`);
    }

    const user = await kysely
      .selectFrom("user")
      .select(["image", "name"])
      .where("user.id", "=", post.userId)
      .executeTakeFirst();

    return { post, user };
  });

export const postsUploadOptions = (postData: Omit<PostsInsert, "key">) =>
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
