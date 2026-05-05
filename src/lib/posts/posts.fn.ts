import { randomUUID } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Effect } from "effect";
import { kysely } from "src/lib/db/kysely";
import { postsSelectSchema } from "src/lib/db/schema";
import { z } from "zod";

import { auth } from "../auth";
import { Debug, withMinimumLogLevel } from "../effect/logger";
import { envServer } from "../env/server";
import {
  FormFileUploadSchema,
  postByTagSchema,
  searchPostsBaseSchema,
  updatePostInputSchema,
} from "./posts.schema";
import { mapPopularTags } from "./posts.utils";
import type { AllowedVideoExtension } from "./posts.utils";

const PAGE_SIZE = 30;

export const searchPosts = createServerFn()
  .inputValidator((input: unknown) => searchPostsBaseSchema.parse(input))
  .handler(({ data }) =>
    Effect.runPromise(
      Effect.fn("searchPosts")(
        function* () {
          const { q, tags, page, sortBy, dateRange } = data;
          const offset = page * PAGE_SIZE;
          yield* Effect.logDebug(`Query for page ${page}`);

          let query = kysely.selectFrom("posts").selectAll("posts");

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
            query = query
              .innerJoin("post_tags", "post_tags.postId", "posts.id")
              .innerJoin("tags", "tags.id", "post_tags.tagId")
              .where("tags.name", "in", tags)
              .distinct();
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

            query = query.where("posts.createdAt", ">=", startDate);
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

          const posts = parsed;
          const hasMore = offset + PAGE_SIZE < totalCount;
          const hasPrevious = offset > 0;

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
              startDate,
            );
          }

          const popularTagsResult = yield* Effect.tryPromise({
            try: () =>
              popularTagsQuery
                .select([
                  "tags.id",
                  "tags.name",
                  kysely.fn.count("post_tags.postId").as("postCount"),
                ])
                .groupBy(["tags.id", "tags.name"])
                .orderBy("postCount", "desc")
                .limit(10)
                .execute(),
            catch: (error) =>
              new Error(
                `Failed to fetch popular tags: ${String(error)}`,
              ),
          });

          const totalPages = Math.ceil(totalCount / PAGE_SIZE);
          const currentPage = page + 1;

          return {
            data: posts,
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
        },
        Effect.provide(withMinimumLogLevel(Debug)),
      )(),
    ),
  );

export const fetchPostDetail = createServerFn()
  .inputValidator((postId: unknown) => z.coerce.number().parse(postId))
  .handler(({ data }) =>
    Effect.runPromise(
      Effect.fn("fetchPostDetail")(
        function* () {
          const postId = data;
          yield* Effect.logDebug(`Fetching post details for ${postId}...`);

          const postWithUser = yield* Effect.tryPromise({
            try: () =>
              kysely
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
            return yield* Effect.fail(new Error(`Post ${postId} not found`));
          }

          const tags = yield* Effect.tryPromise({
            try: () =>
              kysely
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
                  kysely
                    .selectFrom("posts")
                    .selectAll()
                    .where("id", "=", postWithUser.relatedPostId as number)
                    .executeTakeFirst(),
                catch: (error) =>
                  new Error(
                    `Failed to fetch related post: ${String(error)}`,
                  ),
              })
            : null;

          yield* Effect.logInfo(`Post ${postId} details fetched.`);

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
        },
        Effect.provide(withMinimumLogLevel(Debug)),
      )(),
    ),
  );

export const uploadPost = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    const raw = Object.fromEntries(data.entries());
    const normalized = {
      relatedPostId: undefined,
      source: undefined,
      ...raw,
      tags: raw.tags ? JSON.parse(raw.tags) : [],
      videoMetadata: raw.videoMetadata
        ? JSON.parse(raw.videoMetadata)
        : undefined,
    };
    return FormFileUploadSchema.parse(normalized);
  })
  .handler(({ data }) =>
    Effect.runPromise(
      Effect.fn("uploadPost")(
        function* () {
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

          yield* Effect.logDebug("Starting file upload...");

          const videoExtName = video.name.split(".").pop() as AllowedVideoExtension;
          const videoBaseName = randomUUID();
          const videoKey = `videos/${userId}/${videoBaseName}.${videoExtName}`;
          const thumbnailKey = `thumbnails/${userId}/${videoBaseName}.jpg`;

          const cfclient = new S3Client({
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

          const videoCommand = new PutObjectCommand({
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

          const thumbnailCommand = new PutObjectCommand({
            Body: Buffer.from(thumbBuffer),
            Bucket: envServer.CLOUDFLARE_BUCKET,
            ContentType: thumbnail.type,
            Key: thumbnailKey,
          });

          const thumbnailcmd = yield* Effect.tryPromise({
            try: () => cfclient.send(thumbnailCommand),
            catch: (error) =>
              new Error(
                `There was an error uploading thumbnail: ${String(error)}`,
              ),
          });

          if (thumbnailcmd.$metadata.httpStatusCode !== 200) {
            return yield* Effect.fail(
              new Error("There was an error uploading thumbnail"),
            );
          }

          yield* Effect.logDebug("Uploading post to database...");
          const newPost = yield* Effect.tryPromise({
            try: () =>
              kysely
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

          const postId = newPost.id;

          if (tags.length > 0) {
            const allTagIds: number[] = [];

            for (const tag of tags) {
              if (tag.id === undefined) {
                const newTag = yield* Effect.tryPromise({
                  try: () =>
                    kysely
                      .insertInto("tags")
                      .values({ name: tag.name })
                      .onConflict((oc) =>
                        oc.column("name").doUpdateSet({ name: tag.name }),
                      )
                      .returning("id")
                      .executeTakeFirstOrThrow(),
                  catch: (error) =>
                    new Error(
                      `Failed to create tag ${tag.name}: ${String(error)}`,
                    ),
                });
                allTagIds.push(newTag.id);
              } else {
                allTagIds.push(tag.id);
              }
            }

            if (allTagIds.length > 0) {
              yield* Effect.tryPromise({
                try: () =>
                  kysely
                    .insertInto("post_tags")
                    .values(allTagIds.map((tagId) => ({ postId, tagId })))
                    .execute(),
                catch: (error) =>
                  new Error(
                    `Failed to link tags to post: ${String(error)}`,
                  ),
              });
            }
          }

          yield* Effect.logInfo(`Post ${postId} uploaded successfully.`);
          return newPost;
        },
        Effect.provide(withMinimumLogLevel(Debug)),
      )(),
    ),
  );

export const updatePost = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updatePostInputSchema.parse(input))
  .handler(({ data }) =>
    Effect.runPromise(
      Effect.fn("updatePost")(
        function* () {
          yield* Effect.logDebug("Checking session for post update...");
          const session = yield* Effect.tryPromise({
            try: () =>
              auth.api.getSession({
                headers: getRequestHeaders(),
                query: { disableCookieCache: true },
              }),
            catch: (error) =>
              new Error(`Failed to get session: ${String(error)}`),
          });

          if (!session?.user) {
            return yield* Effect.fail(
              new Error(
                "Unauthorized: You must be logged in to update a post",
              ),
            );
          }

          const { postId, title, content, source, relatedPostId, tags } = data;

          const post = yield* Effect.tryPromise({
            try: () =>
              kysely
                .selectFrom("posts")
                .select(["id", "userId"])
                .where("id", "=", postId)
                .executeTakeFirst(),
            catch: (error) =>
              new Error(
                `Failed to find post ${postId}: ${String(error)}`,
              ),
          });

          if (!post) {
            return yield* Effect.fail(
              new Error(`Post ${postId} not found`),
            );
          }

          if (post.userId !== session.user.id) {
            return yield* Effect.fail(
              new Error("Forbidden: You can only update your own posts"),
            );
          }

          yield* Effect.logDebug(`Updating post ${postId}...`);
          const updatedPost = yield* Effect.tryPromise({
            try: () =>
              kysely
                .updateTable("posts")
                .set({
                  content,
                  relatedPostId,
                  source,
                  title,
                })
                .where("id", "=", postId)
                .returningAll()
                .executeTakeFirstOrThrow(),
            catch: (error) =>
              new Error(
                `Failed to update post ${postId}: ${String(error)}`,
              ),
          });

          if (tags && tags.length > 0) {
            yield* Effect.tryPromise({
              try: () =>
                kysely
                  .deleteFrom("post_tags")
                  .where("postId", "=", postId)
                  .execute(),
              catch: (error) =>
                new Error(
                  `Failed to clear existing tags: ${String(error)}`,
                ),
            });

            const allTagIds: number[] = [];

            for (const tag of tags) {
              if (tag.id === undefined) {
                const newTag = yield* Effect.tryPromise({
                  try: () =>
                    kysely
                      .insertInto("tags")
                      .values({ name: tag.name })
                      .onConflict((oc) =>
                        oc.column("name").doUpdateSet({ name: tag.name }),
                      )
                      .returning("id")
                      .executeTakeFirstOrThrow(),
                  catch: (error) =>
                    new Error(
                      `Failed to create tag: ${String(error)}`,
                    ),
                });
                allTagIds.push(newTag.id);
              } else {
                allTagIds.push(tag.id);
              }
            }

            if (allTagIds.length > 0) {
              yield* Effect.tryPromise({
                try: () =>
                  kysely
                    .insertInto("post_tags")
                    .values(allTagIds.map((tagId) => ({ postId, tagId })))
                    .execute(),
                catch: (error) =>
                  new Error(
                    `Failed to link tags: ${String(error)}`,
                  ),
              });
            }
          } else {
            yield* Effect.tryPromise({
              try: () =>
                kysely
                  .deleteFrom("post_tags")
                  .where("postId", "=", postId)
                  .execute(),
              catch: (error) =>
                new Error(
                  `Failed to clear tags: ${String(error)}`,
                ),
            });
          }

          yield* Effect.logInfo(`Post ${postId} updated successfully.`);
          return updatedPost;
        },
        Effect.provide(withMinimumLogLevel(Debug)),
      )(),
    ),
  );

export const getPostsByTag = createServerFn()
  .inputValidator((input: unknown) => postByTagSchema.parse(input))
  .handler(({ data }) =>
    Effect.runPromise(
      Effect.fn("getPostsByTag")(
        function* () {
          const { tag: tagName, page } = data;
          const offset = page * PAGE_SIZE;

          yield* Effect.logDebug(`Fetching posts for tag "${tagName}"...`);

          let query = kysely
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
              new Error(
                `Error processing posts by tag: ${String(error)}`,
              ),
          });

          const posts = parsed;
          const hasMore = offset + PAGE_SIZE < totalCount;
          const hasPrevious = offset > 0;

          const popularTagsResult = yield* Effect.tryPromise({
            try: () =>
              kysely
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
                .execute(),
            catch: (error) =>
              new Error(
                `Failed to fetch popular tags: ${String(error)}`,
              ),
          });

          const totalPages = Math.ceil(totalCount / PAGE_SIZE);
          const currentPage = page + 1;

          yield* Effect.logInfo(
            `Fetched ${posts.length} posts for tag "${tagName}".`,
          );

          return {
            data: posts,
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
        },
        Effect.provide(withMinimumLogLevel(Debug)),
      )(),
    ),
  );
