import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { kysely } from "src/lib/db/kysely";
import { postsSelectSchema } from "src/lib/db/schema";
import { z } from "zod";
import { auth } from "../auth";
import { envServer } from "../env/server";
import {
  BufferFormUploadSchema,
  fetchPostsInputSchema,
  type PaginatedPostsResponse,
  postIdSchema,
  searchPostsInputSchema,
  updatePostInputSchema,
} from "./posts.schema";

const cfclient = new S3Client({
  region: "auto",
  endpoint: envServer.CLOUDFLARE_R2,
  credentials: {
    accessKeyId: envServer.CLOUDFLARE_ACCESS_KEY,
    secretAccessKey: envServer.CLOUDFLARE_SECRET_KEY,
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
    const postWithUser = await kysely
      .selectFrom("posts")
      .innerJoin("user", "user.id", "posts.userId")
      .select([
        "posts.id",
        "posts.title",
        "posts.content",
        "posts.createdAt",
        "posts.videoKey",
        "posts.source",
        "posts.relatedPostId",
        "user.id as userId",
        "user.name as userName",
        "user.image as userImage",
      ])
      .where("posts.id", "=", ctx.data)
      .executeTakeFirst();

    if (!postWithUser) throw new Error(`Post ${ctx.data} not found`);

    const tags = await kysely
      .selectFrom("post_tags")
      .innerJoin("tags", "tags.id", "post_tags.tagId")
      .select(["tags.id", "tags.name"])
      .where("post_tags.postId", "=", postWithUser.id)
      .execute();

    const relatedPost = postWithUser.relatedPostId
      ? await kysely
          .selectFrom("posts")
          .selectAll()
          .where("id", "=", postWithUser.relatedPostId)
          .executeTakeFirst()
      : null;

    return {
      post: {
        id: postWithUser.id,
        title: postWithUser.title,
        content: postWithUser.content,
        createdAt: postWithUser.createdAt,
        relatedPostId: postWithUser.relatedPostId,
        videoKey: postWithUser.videoKey,
        source: postWithUser.source,
      },
      user: {
        id: postWithUser.userId,
        name: postWithUser.userName,
        image: postWithUser.userImage,
      },
      tags,
      relatedPost,
    };
  });

export const uploadPost = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => BufferFormUploadSchema.parse(input))
  .handler(async ({ data }) => {
    const { video, title, content, userId, source, relatedPostId, tags } = data;
    const ext = video.name.split(".").pop()!;

    // TODO generate a hash based on video content to prevent duplicates instead of random UUID
    const videoKey = `videos/${userId}/${randomUUID()}${ext}`;
    const thumbnailKey = `thumbnails/${userId}/${videoKey
      .split("/")
      .pop()
      ?.replace(ext, ".jpg")}`;

    const videoCommand = new PutObjectCommand({
      Bucket: envServer.CLOUDFLARE_BUCKET,
      Key: videoKey,
      Body: Buffer.from(video.arrayBuffer),
      ContentType: video.type,
    });

    const thumbnailCommand = new PutObjectCommand({
      Bucket: envServer.CLOUDFLARE_BUCKET,
      Key: thumbnailKey,
      Body: Buffer.from(data.thumbnail.arrayBuffer),
      ContentType: data.thumbnail.type,
    });

    const videocmd = await cfclient.send(videoCommand);
    if (videocmd.$metadata.httpStatusCode !== 200)
      throw new Error("There was an error uploading file");

    const thumbnailcmd = await cfclient.send(thumbnailCommand);
    if (thumbnailcmd.$metadata.httpStatusCode !== 200)
      throw new Error("There was an error uploading thumbnail");

    // Create post
    const newPost = await kysely
      .insertInto("posts")
      .values({
        content,
        title,
        userId,
        videoKey,
        thumbnailKey,
        source,
        relatedPostId,
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

export const updatePost = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updatePostInputSchema.parse(input))
  .handler(async ({ data }) => {
    // Get the current user's session
    const session = await auth.api.getSession({
      headers: getRequestHeaders(),
      query: {
        disableCookieCache: true,
      },
    });

    if (!session?.user) {
      throw new Error("Unauthorized: You must be logged in to update a post");
    }

    const { postId, title, content, source, relatedPostId, tags } = data;

    // Verify that the post belongs to the current user
    const post = await kysely
      .selectFrom("posts")
      .select(["id", "userId"])
      .where("id", "=", postId)
      .executeTakeFirst();

    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }

    if (post.userId !== session.user.id) {
      throw new Error("Forbidden: You can only update your own posts");
    }

    // Update the post
    const updatedPost = await kysely
      .updateTable("posts")
      .set({
        title,
        content,
        source,
        relatedPostId,
      })
      .where("id", "=", postId)
      .returningAll()
      .executeTakeFirstOrThrow();

    // Handle tags update - delete existing and recreate
    if (tags && tags.length > 0) {
      // Delete existing post tags
      await kysely
        .deleteFrom("post_tags")
        .where("postId", "=", postId)
        .execute();

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

      // Link post to new tags
      if (allTagIds.length > 0) {
        await kysely
          .insertInto("post_tags")
          .values(allTagIds.map((tagId) => ({ postId, tagId })))
          .execute();
      }
    } else {
      // Delete all tags if no tags provided
      await kysely
        .deleteFrom("post_tags")
        .where("postId", "=", postId)
        .execute();
    }

    return updatedPost;
  });
