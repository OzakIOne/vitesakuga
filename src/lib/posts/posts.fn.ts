import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { kysely } from "src/lib/db/kysely";
import { postsSelectSchema } from "src/lib/db/schema";
import { uploadSchema } from "src/routes/api/posts";
import type { UploadFormValues } from "src/routes/upload";
import { z } from "zod";
import {
  fetchPostsInputSchema,
  postIdSchema,
  searchPostsInputSchema,
  type PaginatedPostsResponse,
} from "./posts.schema";

const cfclient = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY || "",
    secretAccessKey: process.env.CLOUDFLARE_SECRET_KEY || "",
  },
});

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

export const uploadPost = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => uploadSchema.parse(input))
  .handler(async ({ data }) => {
    const { video, title, content, userId, source, relatedPostId, tags } = data;

    const key = `${userId}_${video.name}`;

    const buffer: Buffer =
      video instanceof File
        ? Buffer.from(await video.arrayBuffer())
        : Buffer.from(video.arrayBuffer);

    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET || "",
      Key: key,
      Body: buffer,
      ContentType: video.type,
    });

    const cfcmd = await cfclient.send(command);
    if (cfcmd.$metadata.httpStatusCode !== 200)
      throw new Error("There was an error uploading file");

    // Create post
    const newPost = await kysely
      .insertInto("posts")
      .values({
        content,
        title,
        userId,
        key,
        source: source || null,
        relatedPostId: relatedPostId ? Number(relatedPostId) : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const postId = newPost.id;

    if (tags && tags.length > 0) {
      // Process each tag - create new ones and collect all tag IDs
      const allTagIds: number[] = [];

      for (const tag of tags) {
        if (tag.id === undefined) {
          // Create new tag with conflict handling
          const newTag = await kysely
            .insertInto("tags")
            .values({ name: tag.name })
            .onConflict((oc) =>
              oc.column("name").doUpdateSet({ name: tag.name })
            )
            .returning("id")
            .executeTakeFirstOrThrow();
          allTagIds.push(newTag.id);
        } else {
          allTagIds.push(tag.id);
        }
      }

      // Link post to tags
      if (allTagIds.length > 0) {
        await kysely
          .insertInto("post_tags")
          .values(allTagIds.map((tagId) => ({ postId, tagId })))
          .execute();
      }
    }

    return newPost;
  });
