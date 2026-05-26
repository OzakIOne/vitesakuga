import { Context, Effect, Layer } from "effect";
import { postsSelectSchema } from "src/lib/db/schema";
import { z } from "zod";

import { KyselyDB } from "../db/context";
import {
  FormFileUploadSchema,
  postByTagSchema,
  searchPostsBaseSchema,
  updatePostInputSchema,
  VideoMetadataSchema,
} from "./posts.schema";
import { mapPopularTags } from "./posts.utils";
import type { AllowedVideoExtension } from "./posts.utils";
import {
  ForbiddenError,
  PostNotFoundError,
  UnauthorizedError,
} from "../errors";
import { AuthService, RequestHeadersService } from "../auth/context";

const PAGE_SIZE = 30;

export class PostsService extends Context.Service<
  PostsService,
  {
    readonly search: (
      data: z.infer<typeof searchPostsBaseSchema>,
    ) => Effect.Effect<unknown, Error>;
    readonly fetchDetail: (
      postId: number,
    ) => Effect.Effect<unknown, Error>;
    readonly upload: (
      data: z.infer<typeof FormFileUploadSchema>,
    ) => Effect.Effect<unknown, Error>;
    readonly getByTag: (
      data: z.infer<typeof postByTagSchema>,
    ) => Effect.Effect<unknown, Error>;
    readonly update: (
      data: z.infer<typeof updatePostInputSchema>,
    ) => Effect.Effect<unknown, Error>;
  }
>()("PostsService") {}

const resolveAndLinkTags = Effect.fn("resolveAndLinkTags")(function* (
  db: KyselyDB["Service"],
  postId: number,
  tags: Array<{ id?: number | undefined; name: string }>,
) {
  const allTagIds: number[] = [];

  for (const tag of tags) {
    if (tag.id === undefined) {
      const newTag = yield* Effect.tryPromise({
        try: () =>
          db
            .insertInto("tags")
            .values({ name: tag.name })
            .onConflict((oc) =>
              oc.column("name").doUpdateSet({ name: tag.name }),
            )
            .returning("id")
            .executeTakeFirstOrThrow(),
        catch: (error) =>
          new Error(`Failed to create tag ${tag.name}: ${String(error)}`),
      });
      allTagIds.push(newTag.id);
    } else {
      allTagIds.push(tag.id);
    }
  }

  if (allTagIds.length > 0) {
    yield* Effect.tryPromise({
      try: () =>
        db
          .insertInto("post_tags")
          .values(allTagIds.map((tagId) => ({ postId, tagId })))
          .execute(),
      catch: (error) =>
        new Error(`Failed to link tags to post: ${String(error)}`),
    });
  }
});

export const PostsServiceLive = Layer.effect(
  PostsService,
  Effect.gen(function* () {
    const db = yield* KyselyDB;

    const search = Effect.fn("PostsService.search")(function* (
      data: z.infer<typeof searchPostsBaseSchema>,
    ) {
      const { q, tags, page, sortBy, dateRange } = data;
      const offset = page * PAGE_SIZE;

      let query = db.selectFrom("posts").selectAll("posts");

      if (q) {
        query = query.where((eb) =>
          eb("posts.title", "ilike", `%${q}%`).or(
            "posts.content",
            "ilike",
            `%${q}%`,
          ),
        );
      }

      if (tags.length > 0) {
        query = query.where("posts.id", "in", (eb) =>
          eb
            .selectFrom("post_tags")
            .innerJoin("tags", "tags.id", "post_tags.tagId")
            .where("tags.name", "in", tags)
            .select("post_tags.postId"),
        );
      }

      if (dateRange !== "all") {
        const now = new Date();
        let startDate: Date;
        switch (dateRange) {
          case "today": {
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          }
          case "week": {
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
          }
          case "month": {
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
          }
        }
        query = query.where("posts.createdAt", ">=", startDate!);
      }

      const countQuery = query
        .clearSelect()
        .select((eb) => eb.fn.countAll().as("count"));
      const countResult = yield* Effect.tryPromise({
        try: () => countQuery.executeTakeFirst(),
        catch: (error) =>
          new Error(`Failed to count posts: ${String(error)}`),
      });
      const totalCount = Number(countResult?.count ?? 0);

      query = query.orderBy(
        "posts.createdAt",
        sortBy === "oldest" ? "asc" : "desc",
      );

      const items = yield* Effect.tryPromise({
        try: () => query.offset(offset).limit(PAGE_SIZE).execute(),
        catch: (error) =>
          new Error(`Failed to fetch posts: ${String(error)}`),
      });

      const parsed = yield* Effect.try({
        try: () => z.array(postsSelectSchema).parse(items),
        catch: (error) =>
          new Error(`Error processing search results: ${String(error)}`),
      });

      const hasMore = offset + PAGE_SIZE < totalCount;
      const hasPrevious = offset > 0;

      let popularTagsQuery = db
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
          case "today": {
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          }
          case "week": {
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
          }
          case "month": {
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
          }
        }
        popularTagsQuery = popularTagsQuery.where(
          "posts.createdAt",
          ">=",
          startDate!,
        );
      }

      const popularTagsResult = yield* Effect.tryPromise({
        try: () =>
          popularTagsQuery
            .select([
              "tags.id",
              "tags.name",
              db.fn.count("post_tags.postId").as("postCount"),
            ])
            .groupBy(["tags.id", "tags.name"])
            .orderBy("postCount", "desc")
            .limit(10)
            .execute(),
        catch: (error) =>
          new Error(`Failed to fetch popular tags: ${String(error)}`),
      });

      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      const currentPage = page + 1;

      return {
        data: parsed,
        meta: {
          pagination: {
            currentPage,
            hasMore,
            hasPrevious,
            limit: PAGE_SIZE,
            offset,
            total: totalCount,
            totalPages,
          },
          popularTags: mapPopularTags(popularTagsResult),
        },
      };
    });

    const fetchDetail = Effect.fn("PostsService.fetchDetail")(function* (
      postId: number,
    ) {
      const postWithUser = yield* Effect.tryPromise({
        try: () =>
          db
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
            .executeTakeFirst(),
        catch: (error) =>
          new Error(`Failed to fetch post ${postId}: ${String(error)}`),
      });

      if (!postWithUser) {
        return yield* Effect.fail(
          new PostNotFoundError({
            message: `Post ${postId} not found`,
            postId,
          }),
        );
      }

      const tags = yield* Effect.tryPromise({
        try: () =>
          db
            .selectFrom("post_tags")
            .innerJoin("tags", "tags.id", "post_tags.tagId")
            .select(["tags.id", "tags.name"])
            .where("post_tags.postId", "=", postWithUser.id)
            .execute(),
        catch: (error) =>
          new Error(
            `Failed to fetch tags for post ${postId}: ${String(error)}`,
          ),
      });

      const relatedPost = postWithUser.relatedPostId
        ? yield* Effect.tryPromise({
            try: () =>
              db
                .selectFrom("posts")
                .selectAll()
                .where("id", "=", postWithUser.relatedPostId as number)
                .executeTakeFirst(),
            catch: (error) =>
              new Error(`Failed to fetch related post: ${String(error)}`),
          })
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
          videoMetadata: VideoMetadataSchema.parse(postWithUser.videoMetadata),
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

    const upload = Effect.fn("PostsService.upload")(function* (
      data: z.infer<typeof FormFileUploadSchema>,
    ) {
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

      const envServer = yield* Effect.tryPromise({
        try: async () => (await import("../env/server")).envServer,
        catch: (error) =>
          new Error(`Failed to load environment: ${String(error)}`),
      });

      const s3 = yield* Effect.tryPromise({
        try: async () => {
          const mod = await import("@aws-sdk/client-s3");
          return {
            PutObjectCommand: mod.PutObjectCommand,
            S3Client: mod.S3Client,
          };
        },
        catch: (error) =>
          new Error(`Failed to load S3 client: ${String(error)}`),
      });

      const videoExtName = video.name.split(".").pop() as AllowedVideoExtension;
      const videoBaseName = crypto.randomUUID();
      const videoKey = `videos/${userId}/${videoBaseName}.${videoExtName}`;
      const thumbnailKey = `thumbnails/${userId}/${videoBaseName}.jpg`;

      const cfclient = new s3.S3Client({
        credentials: {
          accessKeyId: envServer.CLOUDFLARE_ACCESS_KEY,
          secretAccessKey: envServer.CLOUDFLARE_SECRET_KEY,
        },
        endpoint: envServer.CLOUDFLARE_R2,
        region: "auto",
      });

      const videoBuffer = yield* Effect.tryPromise({
        try: () => video.arrayBuffer(),
        catch: (error) =>
          new Error(`Failed to read video file: ${String(error)}`),
      });

      const videoCommand = new s3.PutObjectCommand({
        Body: Buffer.from(videoBuffer),
        Bucket: envServer.CLOUDFLARE_BUCKET,
        ContentType: video.type,
        Key: videoKey,
      });

      const videocmd = yield* Effect.tryPromise({
        try: () => cfclient.send(videoCommand),
        catch: (error) =>
          new Error(`There was an error uploading file: ${String(error)}`),
      });

      if (videocmd.$metadata.httpStatusCode !== 200) {
        return yield* Effect.fail(
          new Error("There was an error uploading file"),
        );
      }

      const thumbBuffer = yield* Effect.tryPromise({
        try: () => thumbnail.arrayBuffer(),
        catch: (error) =>
          new Error(`Failed to read thumbnail file: ${String(error)}`),
      });

      const thumbnailCommand = new s3.PutObjectCommand({
        Body: Buffer.from(thumbBuffer),
        Bucket: envServer.CLOUDFLARE_BUCKET,
        ContentType: thumbnail.type,
        Key: thumbnailKey,
      });

      const thumbnailcmd = yield* Effect.tryPromise({
        try: () => cfclient.send(thumbnailCommand),
        catch: (error) =>
          new Error(`There was an error uploading thumbnail: ${String(error)}`),
      });

      if (thumbnailcmd.$metadata.httpStatusCode !== 200) {
        return yield* Effect.fail(
          new Error("There was an error uploading thumbnail"),
        );
      }

      const newPost = yield* Effect.tryPromise({
        try: () =>
          db
            .insertInto("posts")
            .values({
              content,
              relatedPostId,
              source,
              thumbnailKey,
              title,
              userId,
              videoKey,
              videoMetadata: JSON.stringify(videoMetadata ?? {}),
            })
            .returningAll()
            .executeTakeFirstOrThrow(),
        catch: (error) =>
          new Error(`Failed to create post: ${String(error)}`),
      });

      if (tags.length > 0) {
        yield* resolveAndLinkTags(db, newPost.id, tags);
      }

      return newPost;
    });

    const getByTag = Effect.fn("PostsService.getByTag")(function* (
      data: z.infer<typeof postByTagSchema>,
    ) {
      const { tag: tagName, page } = data;
      const offset = page * PAGE_SIZE;

      let query = db
        .selectFrom("posts")
        .innerJoin("post_tags", "post_tags.postId", "posts.id")
        .innerJoin("tags", "tags.id", "post_tags.tagId")
        .where("tags.name", "=", tagName)
        .selectAll("posts");

      const countQuery = query
        .clearSelect()
        .select((eb) => eb.fn.countAll().as("count"));
      const countResult = yield* Effect.tryPromise({
        try: () => countQuery.executeTakeFirst(),
        catch: (error) =>
          new Error(`Failed to count posts: ${String(error)}`),
      });
      const totalCount = Number(countResult?.count ?? 0);

      query = query.orderBy("posts.createdAt", "desc");

      const items = yield* Effect.tryPromise({
        try: () => query.offset(offset).limit(PAGE_SIZE).execute(),
        catch: (error) =>
          new Error(`Failed to fetch posts: ${String(error)}`),
      });

      const parsed = yield* Effect.try({
        try: () => z.array(postsSelectSchema).parse(items),
        catch: (error) =>
          new Error(`Error processing posts by tag: ${String(error)}`),
      });

      const hasMore = offset + PAGE_SIZE < totalCount;
      const hasPrevious = offset > 0;

      const popularTagsResult = yield* Effect.tryPromise({
        try: () =>
          db
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
              db.fn.count("post_tags.postId").as("postCount"),
            ])
            .groupBy(["tags.id", "tags.name"])
            .orderBy("postCount", "desc")
            .limit(10)
            .execute(),
        catch: (error) =>
          new Error(`Failed to fetch popular tags: ${String(error)}`),
      });

      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      const currentPage = page + 1;

      return {
        data: parsed,
        meta: {
          pagination: {
            currentPage,
            hasMore,
            hasPrevious,
            limit: PAGE_SIZE,
            offset,
            total: totalCount,
            totalPages,
          },
          popularTags: mapPopularTags(popularTagsResult),
        },
      };
    });

    const update = Effect.fn("PostsService.update")(function* (
      data: z.infer<typeof updatePostInputSchema>,
    ) {
      const authSvc = yield* AuthService;
      const getHeaders = yield* RequestHeadersService;

      const session = yield* Effect.tryPromise({
        try: () =>
          authSvc.api.getSession({
            headers: getHeaders(),
            query: { disableCookieCache: true },
          }),
        catch: (error) =>
          new Error(`Failed to get session: ${String(error)}`),
      });

      if (!session?.user) {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: "You must be logged in to update a post",
          }),
        );
      }

      const { postId, title, content, source, relatedPostId, tags } = data;

      const post = yield* Effect.tryPromise({
        try: () =>
          db
            .selectFrom("posts")
            .select(["id", "userId"])
            .where("id", "=", postId)
            .executeTakeFirst(),
        catch: (error) =>
          new Error(`Failed to find post ${postId}: ${String(error)}`),
      });

      if (!post) {
        return yield* Effect.fail(
          new PostNotFoundError({
            message: `Post ${postId} not found`,
            postId,
          }),
        );
      }

      if (post.userId !== session.user.id) {
        return yield* Effect.fail(
          new ForbiddenError({
            message: "You can only update your own posts",
          }),
        );
      }

      const updatedPost = yield* Effect.tryPromise({
        try: () =>
          db
            .updateTable("posts")
            .set({ content, relatedPostId, source, title })
            .where("id", "=", postId)
            .returningAll()
            .executeTakeFirstOrThrow(),
        catch: (error) =>
          new Error(`Failed to update post ${postId}: ${String(error)}`),
      });

      if (tags && tags.length > 0) {
        yield* Effect.tryPromise({
          try: () =>
            db
              .deleteFrom("post_tags")
              .where("postId", "=", postId)
              .execute(),
          catch: (error) =>
            new Error(`Failed to clear existing tags: ${String(error)}`),
        });
        yield* resolveAndLinkTags(db, postId, tags);
      } else {
        yield* Effect.tryPromise({
          try: () =>
            db
              .deleteFrom("post_tags")
              .where("postId", "=", postId)
              .execute(),
          catch: (error) =>
            new Error(`Failed to clear tags: ${String(error)}`),
        });
      }

      return updatedPost;
    });

    return { search, fetchDetail, upload, getByTag, update };
  }),
);
