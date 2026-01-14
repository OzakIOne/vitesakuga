import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { randomUUID } from "crypto";
import { kysely } from "src/lib/db/kysely";
import { postsSelectSchema } from "src/lib/db/schema";
import { z } from "zod";
import { auth } from "../auth";
import { envServer } from "../env/server";
import {
  FormFileUploadSchema,
  searchPostsServerSchema,
  updatePostInputSchema,
} from "./posts.schema";
import { mapPopularTags } from "./posts.utils";

const cfclient = new S3Client({
  credentials: {
    accessKeyId: envServer.CLOUDFLARE_ACCESS_KEY,
    secretAccessKey: envServer.CLOUDFLARE_SECRET_KEY,
  },
  endpoint: envServer.CLOUDFLARE_R2,
  region: "auto",
});

export const searchPosts = createServerFn()
  .inputValidator((input: unknown) => searchPostsServerSchema.parse(input))
  .handler(async ({ data }) => {
    const { q, tags, page, pageSize, sortBy, dateRange } = data;
    const offset = page * pageSize;
    console.log("Query for page", page);
    let query = kysely.selectFrom("posts").selectAll("posts");

    // Search filter
    if (q) {
      query = query.where((eb) =>
        eb("posts.title", "ilike", `%${q}%`).or(
          "posts.content",
          "ilike",
          `%${q}%`,
        ),
      );
    }

    // Tags filter
    if (tags.length > 0) {
      query = query
        .innerJoin("post_tags", "post_tags.postId", "posts.id")
        .innerJoin("tags", "tags.id", "post_tags.tagId")
        .where("tags.name", "in", tags)
        .distinct();
    }

    // Date range filter
    if (dateRange !== "all") {
      const now = new Date();
      let startDate: Date;

      switch (dateRange) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "week":
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "month":
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
      }

      query = query.where("posts.createdAt", ">=", startDate);
    }

    // Get total count for pagination metadata
    const countQuery = query
      .clearSelect()
      .select((eb) => eb.fn.countAll().as("count"));

    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    // Sort
    query = query.orderBy(
      "posts.createdAt",
      sortBy === "oldest" ? "asc" : "desc",
    );

    // Apply offset and limit
    const items = await query.offset(offset).limit(pageSize).execute();

    const parsed = z.array(postsSelectSchema).safeParse(items);
    if (!parsed.success) {
      throw new Error(
        `Error processing search results: ${parsed.error.message}`,
      );
    }

    const posts = parsed.data;
    const hasMore = offset + pageSize < totalCount;
    const hasPrevious = offset > 0;

    // Calculate popular tags for posts matching the search query
    let popularTagsQuery = kysely
      .selectFrom("tags")
      .innerJoin("post_tags", "tags.id", "post_tags.tagId")
      .innerJoin("posts", "posts.id", "post_tags.postId");

    if (q) {
      popularTagsQuery = popularTagsQuery.where((eb) =>
        eb("posts.title", "ilike", `%${q}%`).or(
          "posts.content",
          "ilike",
          `%${q}%`,
        ),
      );
    }

    if (dateRange !== "all") {
      const now = new Date();
      let startDate: Date;

      switch (dateRange) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "week":
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "month":
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
      }

      popularTagsQuery = popularTagsQuery.where(
        "posts.createdAt",
        ">=",
        startDate,
      );
    }

    const popularTagsResult = await popularTagsQuery
      .select([
        "tags.id",
        "tags.name",
        kysely.fn.count("post_tags.postId").as("postCount"),
      ])
      .groupBy(["tags.id", "tags.name"])
      .orderBy("postCount", "desc")
      .limit(10)
      .execute();

    const totalPages = Math.ceil(totalCount / pageSize);
    // currentPage in response can be 1-based for frontend convenience if desired,
    // but let's keep it consistent with input (0-based) or return both.
    // Standard practice often returns the requested page.
    // The previous implementation returned `Math.floor(offset / size) + 1` (1-based).
    // Let's stick to returning 1-based current page to be friendly to UI, or matches legacy behavior?
    // User requested "page=0 is 0-30", so input is 0-based.
    // Let's return the 0-based page to match input, OR return 1-based for UI display.
    // I'll return `page` (0-based) as `pageIndex` and `page + 1` as `currentPage` to be safe/explicit?
    // Actually the previous return was:
    // currentPage: Math.floor(offset / size) + 1;
    // Let's keep `currentPage` as 1-based for UI.
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
    };
  });

export const fetchPostDetail = createServerFn()
  .inputValidator((postId: unknown) => z.coerce.number().parse(postId))
  .handler(async ({ data }) => {
    const postId = data;

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
        "posts.videoMetadata",
        "user.id as userId",
        "user.name as userName",
        "user.image as userImage",
      ])
      .where("posts.id", "=", postId)
      .executeTakeFirst();

    if (!postWithUser) {
      throw new Error(`Post ${postId} not found`);
    }

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
        content: postWithUser.content,
        createdAt: postWithUser.createdAt,
        id: postWithUser.id,
        relatedPostId: postWithUser.relatedPostId,
        source: postWithUser.source,
        title: postWithUser.title,
        videoKey: postWithUser.videoKey,
        videoMetadata: postWithUser.videoMetadata,
      },
      relatedPost,
      tags,
      user: {
        id: postWithUser.userId,
        image: postWithUser.userImage,
        name: postWithUser.userName,
      },
    };
  });

export const uploadPost = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    const raw = Object.fromEntries(data.entries());
    const normalized = {
      ...raw,
      tags: raw.tags ? JSON.parse(raw.tags as string) : [],
      videoMetadata: raw.videoMetadata
        ? JSON.parse(raw.videoMetadata as string)
        : undefined,
    };
    return FormFileUploadSchema.parse(normalized);
  })
  .handler(async ({ data }) => {
    const {
      video,
      thumbnail,
      title,
      content,
      userId,
      source,
      relatedPostId,
      tags,
      videoMetadata,
    } = data;

    const ext = video.name.split(".").pop()!;

    const videoKey = `videos/${userId}/${randomUUID()}.${ext}`;
    const thumbnailKey = `thumbnails/${userId}/${videoKey
      .split("/")
      .pop()!
      .replace(new RegExp(`\\.${ext}$`), ".jpg")}`;

    const videoCommand = new PutObjectCommand({
      Body: Buffer.from(await video.arrayBuffer()),
      Bucket: envServer.CLOUDFLARE_BUCKET,
      ContentType: video.type,
      Key: videoKey,
    });

    const thumbnailCommand = new PutObjectCommand({
      Body: Buffer.from(await thumbnail.arrayBuffer()),
      Bucket: envServer.CLOUDFLARE_BUCKET,
      ContentType: thumbnail.type,
      Key: thumbnailKey,
    });

    const videocmd = await cfclient.send(videoCommand);
    if (videocmd.$metadata.httpStatusCode !== 200) {
      throw new Error("There was an error uploading file");
    }

    const thumbnailcmd = await cfclient.send(thumbnailCommand);
    if (thumbnailcmd.$metadata.httpStatusCode !== 200) {
      throw new Error("There was an error uploading thumbnail");
    }

    // Create post
    const newPost = await kysely
      .insertInto("posts")
      .values({
        content,
        relatedPostId,
        source,
        thumbnailKey,
        title,
        userId,
        videoKey,
        videoMetadata: JSON.stringify(videoMetadata),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const postId = newPost.id;

    if (tags.length > 0) {
      // Process each tag - create new ones and collect all tag IDs
      const allTagIds: number[] = [];

      for (const tag of tags) {
        if (tag.id === undefined) {
          // Create new tag with conflict handling
          const newTag = await kysely
            .insertInto("tags")
            .values({ name: tag.name })
            .onConflict((oc) =>
              oc.column("name").doUpdateSet({ name: tag.name }),
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

// TODO see how this handle partial errors, like if something broke does it create an inconsistent state?
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
        content,
        relatedPostId,
        source,
        title,
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
              oc.column("name").doUpdateSet({ name: tag.name }),
            )
            .returning("id")
            .executeTakeFirstOrThrow();
          allTagIds.push(newTag.id);
        } else allTagIds.push(tag.id);
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

export const getPostsByTag = createServerFn()
  .inputValidator((input: unknown) =>
    z
      .object({
        page: z.number().min(0).default(0),
        pageSize: z.number().min(1).max(100).default(20),
        tag: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { tag: tagName, page, pageSize } = data;
    const offset = page * pageSize;

    // Fetch posts for the specific tag with pagination
    let query = kysely
      .selectFrom("posts")
      .innerJoin("post_tags", "post_tags.postId", "posts.id")
      .innerJoin("tags", "tags.id", "post_tags.tagId")
      .where("tags.name", "=", tagName)
      .selectAll("posts");

    // Get total count for pagination metadata
    const countQuery = query
      .clearSelect()
      .select((eb) => eb.fn.countAll().as("count"));
    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    // Sort
    query = query.orderBy("posts.createdAt", "desc");

    // Apply offset and limit
    const items = await query.offset(offset).limit(pageSize).execute();

    const parsed = z.array(postsSelectSchema).safeParse(items);
    if (!parsed.success) {
      throw new Error(`Error processing posts by tag: ${parsed.error.message}`);
    }

    const posts = parsed.data;
    const hasMore = offset + pageSize < totalCount;
    const hasPrevious = offset > 0;

    // Calculate popular tags for posts that share the same tag
    const popularTagsResult = await kysely
      .selectFrom("tags")
      .innerJoin("post_tags", "tags.id", "post_tags.tagId")
      .innerJoin("posts", "posts.id", "post_tags.postId")
      .where("posts.id", "in", (eb) =>
        eb
          .selectFrom("posts")
          .innerJoin("post_tags", "post_tags.postId", "posts.id")
          .innerJoin("tags", "tags.id", "post_tags.tagId")
          .where("tags.name", "=", tagName)
          .select("posts.id"),
      )
      .select([
        "tags.id",
        "tags.name",
        kysely.fn.count("post_tags.postId").as("postCount"),
      ])
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
    };
  });
