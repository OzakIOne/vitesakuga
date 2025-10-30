import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { kysely } from "src/lib/db/kysely";
import { postsSelectSchema } from "src/lib/db/schema";
import { DEPLOY_URL } from "src/lib/users/users.fn";
import type { UploadFormValues } from "src/routes/upload";
import { z } from "zod";
import {
  fetchPostsInputSchema,
  postIdSchema,
  searchPostsInputSchema,
  type PaginatedPostsResponse,
} from "./posts.schema";

export const fetchPosts = createServerFn()
  .inputValidator((input: unknown) => fetchPostsInputSchema.parse(input))
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
  .inputValidator((input: unknown) => searchPostsInputSchema.parse(input))
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

export const fetchPost = createServerFn()
  .inputValidator((id: unknown) => postIdSchema.parse(id))
  .handler(async (ctx) => {
    const post = await kysely
      .selectFrom("posts")
      .selectAll()
      .where("id", "=", ctx.data)
      .executeTakeFirst();

    if (!post) throw new Error(`Post ${ctx.data} not found`);

    const user = await kysely
      .selectFrom("user")
      .select(["image", "name", "id"])
      .where("user.id", "=", post.userId)
      .executeTakeFirst();

    // ? useless? post must always be bind to a user so if a post is found then there is a user bind to it
    if (!user) throw new Error(`User not found`);

    // Fetch tags for the post
    const tags = await kysely
      .selectFrom("post_tags")
      .innerJoin("tags", "tags.id", "post_tags.tagId")
      .select(["tags.id", "tags.name"])
      .where("post_tags.postId", "=", post.id)
      .execute();

    // Fetch related post if exists
    const relatedPost = post.relatedPostId
      ? await kysely
          .selectFrom("posts")
          .selectAll()
          .where("id", "=", post.relatedPostId)
          .executeTakeFirst()
      : null;

    return { post, user, tags, relatedPost };
  });

export const postsUploadOptions = (postData: UploadFormValues) =>
  queryOptions({
    queryKey: ["posts", "upload", postData],
    queryFn: async () => {
      const formData = new FormData();

      // cast to string numbers boolean
      // array are json stringified
      Object.entries(postData).forEach(([key, value]) => {
        if (value != null) {
          if (value instanceof File) {
            formData.append(key, value);
          } else if (Array.isArray(value) || typeof value === "object") {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, String(value));
          }
        }
      });

      const res = await fetch(`${DEPLOY_URL}/api/posts`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error((await res.json()) || "Failed to upload post");
      }

      return res.json();
    },
  });
