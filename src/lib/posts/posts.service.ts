import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer, Option } from "effect";
import { postsSelectSchema } from "src/lib/db/schema";
import { z } from "zod";

import { getSessionEffect } from "../auth/auth.middleware";
import { KyselyDB } from "../db/context";
import { makeAuthLayer } from "../db/layer-factories.server";
import {
  ForbiddenError,
  PostNotFoundError,
  UnauthorizedError,
} from "../errors";
import { computePagination } from "../pagination/pagination";
import { createHandler } from "../server-fn.handler";
import { StorageModule } from "../storage/storage.module";
import { mapPopularTags } from "../tags/tags.utils";
import {
  FormFileUploadSchema,
  postByTagSchema,
  searchPostsBaseSchema,
  updatePostInputSchema,
  VideoMetadataSchema,
} from "./posts.schema";

const PAGE_SIZE = 30;

export class PostsService extends Context.Service<
  PostsService,
  {
    readonly search: (
      data: z.infer<typeof searchPostsBaseSchema>,
    ) => Effect.Effect<unknown, Error>;
    readonly fetchDetail: (postId: number) => Effect.Effect<unknown, Error>;
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
      const newTag = yield* db.executeTakeFirstOrError(
        db
          .insertInto("tags")
          .values({ name: tag.name })
          .onConflict((oc) => oc.column("name").doUpdateSet({ name: tag.name }))
          .returning("id"),
      );
      allTagIds.push(newTag.id);
    } else {
      allTagIds.push(tag.id);
    }
  }

  if (allTagIds.length > 0) {
    yield* db.execute(
      db
        .insertInto("post_tags")
        .values(allTagIds.map((tagId) => ({ postId, tagId }))),
    );
  }
});

export const PostsServiceLive = Layer.effect(
  PostsService,
  Effect.gen(function* () {
    const db = yield* KyselyDB;
    const storage = yield* StorageModule;

    const search = Effect.fn("PostsService.search")(function* (
      data: z.infer<typeof searchPostsBaseSchema>,
    ) {
      const { q, tags, page, sortBy, dateRange } = data;

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
      const countResult = yield* db.executeTakeFirstOrUndefined(countQuery);
      const totalCount = Number(countResult?.count ?? 0);

      const pagination = computePagination(totalCount, {
        page,
        pageSize: PAGE_SIZE,
      });

      query = query.orderBy(
        "posts.createdAt",
        sortBy === "oldest" ? "asc" : "desc",
      );

      const items = yield* db.execute(
        query.offset(pagination.offset).limit(PAGE_SIZE),
      );

      const parsed = yield* Effect.try({
        try: () => z.array(postsSelectSchema).parse(items),
        catch: (error) =>
          new Error(`Error processing search results: ${String(error)}`),
      });

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

      const popularTagsResult = yield* db.execute(
        popularTagsQuery
          .select([
            "tags.id",
            "tags.name",
            db.fn.count("post_tags.postId").as("postCount"),
          ])
          .groupBy(["tags.id", "tags.name"])
          .orderBy("postCount", "desc")
          .limit(10),
      );

      return {
        data: parsed,
        meta: {
          pagination,
          popularTags: mapPopularTags(popularTagsResult),
        },
      };
    });

    const fetchDetail = Effect.fn("PostsService.fetchDetail")(function* (
      postId: number,
    ) {
      const postOption = yield* db.executeTakeFirstOption(
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
          .where("posts.id", "=", postId),
      );

      const postWithUser = yield* Option.match(postOption, {
        onNone: () =>
          Effect.fail(
            new PostNotFoundError({
              message: `Post ${postId} not found`,
              postId,
            }),
          ),
        onSome: (value) => Effect.succeed(value),
      });

      const tags = yield* db.execute(
        db
          .selectFrom("post_tags")
          .innerJoin("tags", "tags.id", "post_tags.tagId")
          .select(["tags.id", "tags.name"])
          .where("post_tags.postId", "=", postWithUser.id),
      );

      const relatedPostOption = postWithUser.relatedPostId
        ? yield* db.executeTakeFirstOption(
            db
              .selectFrom("posts")
              .selectAll()
              .where("id", "=", postWithUser.relatedPostId as number),
          )
        : Option.none();

      const relatedPost = Option.match(relatedPostOption, {
        onNone: () => null,
        onSome: (value) => value,
      });

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

      yield* Effect.logInfo("Upload started").pipe(
        Effect.annotateLogs({
          fileName: video.name,
          fileSize: video.size,
          title,
          userId,
        }),
      );

      const { key: videoKey } = yield* storage.uploadVideo(userId, video);
      const { key: thumbnailKey } = yield* storage.uploadThumbnail(
        userId,
        thumbnail,
      );

      const newPost = yield* db.executeTakeFirstOrError(
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
          .returningAll(),
      );

      if (tags.length > 0) {
        yield* resolveAndLinkTags(db, newPost.id, tags);
        yield* Effect.logInfo("Tags linked to post").pipe(
          Effect.annotateLogs({
            postId: String(newPost.id),
            tagCount: tags.length,
          }),
        );
      }

      yield* Effect.logInfo("Upload completed").pipe(
        Effect.annotateLogs("postId", String(newPost.id)),
      );

      return newPost;
    });

    const getByTag = Effect.fn("PostsService.getByTag")(function* (
      data: z.infer<typeof postByTagSchema>,
    ) {
      const { tag: tagName, page } = data;

      let query = db
        .selectFrom("posts")
        .innerJoin("post_tags", "post_tags.postId", "posts.id")
        .innerJoin("tags", "tags.id", "post_tags.tagId")
        .where("tags.name", "=", tagName)
        .selectAll("posts");

      const countQuery = query
        .clearSelect()
        .select((eb) => eb.fn.countAll().as("count"));
      const countResult = yield* db.executeTakeFirstOrUndefined(countQuery);
      const totalCount = Number(countResult?.count ?? 0);

      const pagination = computePagination(totalCount, {
        page,
        pageSize: PAGE_SIZE,
      });

      query = query.orderBy("posts.createdAt", "desc");

      const items = yield* db.execute(
        query.offset(pagination.offset).limit(PAGE_SIZE),
      );

      const parsed = yield* Effect.try({
        try: () => z.array(postsSelectSchema).parse(items),
        catch: (error) =>
          new Error(`Error processing posts by tag: ${String(error)}`),
      });

      const popularTagsResult = yield* db.execute(
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
          .limit(10),
      );

      return {
        data: parsed,
        meta: {
          pagination,
          popularTags: mapPopularTags(popularTagsResult),
        },
      };
    });

    const update = Effect.fn("PostsService.update")(function* (
      data: z.infer<typeof updatePostInputSchema>,
    ) {
      const session = yield* getSessionEffect();

      if (!session?.user) {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: "You must be logged in to update a post",
          }),
        );
      }

      const { postId, title, content, source, relatedPostId, tags } = data;

      yield* Effect.logInfo("Post update started").pipe(
        Effect.annotateLogs({ postId: String(postId), userId: session.user.id }),
      );

      const postOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("posts")
          .select(["id", "userId"])
          .where("id", "=", postId),
      );

      const post = yield* Option.match(postOption, {
        onNone: () =>
          Effect.fail(
            new PostNotFoundError({
              message: `Post ${postId} not found`,
              postId,
            }),
          ),
        onSome: (value) => Effect.succeed(value),
      });

      if (post.userId !== session.user.id) {
        return yield* Effect.fail(
          new ForbiddenError({
            message: "You can only update your own posts",
          }),
        );
      }

      const updatedPost = yield* db.executeTakeFirstOrError(
        db
          .updateTable("posts")
          .set({ content, relatedPostId, source, title })
          .where("id", "=", postId)
          .returningAll(),
      );

      if (tags && tags.length > 0) {
        yield* db.execute(
          db.deleteFrom("post_tags").where("postId", "=", postId),
        );
        yield* resolveAndLinkTags(db, postId, tags);
      } else {
        yield* db.execute(
          db.deleteFrom("post_tags").where("postId", "=", postId),
        );
      }

      yield* Effect.logInfo("Post updated").pipe(
        Effect.annotateLogs("postId", String(postId)),
      );

      return updatedPost;
    });

    return {
      search,
      fetchDetail,
      upload,
      getByTag,
      update,
    } as unknown as PostsService["Service"];
  }),
);

export const searchPostsEffect = Effect.fn("searchPosts")(function* (
  data: z.infer<typeof searchPostsBaseSchema>,
) {
  const svc = yield* PostsService;
  return yield* svc.search(data);
});

export const fetchPostDetailEffect = Effect.fn("fetchPostDetail")(function* (
  postId: number,
) {
  const svc = yield* PostsService;
  return yield* svc.fetchDetail(postId);
});

export const uploadPostEffect = Effect.fn("uploadPost")(function* (
  data: z.infer<typeof FormFileUploadSchema>,
) {
  const svc = yield* PostsService;
  return yield* svc.upload(data).pipe(
    Effect.tapError((error) =>
      Effect.logError("Upload failed").pipe(
        Effect.annotateLogs({
          error: String(error),
          fileName: data.video.name,
          fileSize: data.video.size,
          title: data.title,
          userId: data.userId,
        }),
      ),
    ),
  );
});

export const getPostsByTagEffect = Effect.fn("getPostsByTag")(function* (
  data: z.infer<typeof postByTagSchema>,
) {
  const svc = yield* PostsService;
  return yield* svc.getByTag(data);
});

export const updatePostEffect = Effect.fn("updatePost")(function* (
  data: z.infer<typeof updatePostInputSchema>,
) {
  const svc = yield* PostsService;
  return yield* svc.update(data);
});

export const searchPosts = createServerFn()
  .inputValidator((input: unknown) => searchPostsBaseSchema.parse(input))
  .handler(createHandler(searchPostsEffect, PostsServiceLive));

export const fetchPostDetail = createServerFn()
  .inputValidator((postId: unknown) => z.coerce.number().parse(postId))
  .handler(createHandler(fetchPostDetailEffect, PostsServiceLive));

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
  .handler(createHandler(uploadPostEffect, PostsServiceLive));

export const updatePost = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updatePostInputSchema.parse(input))
  .handler(createHandler(updatePostEffect, PostsServiceLive, makeAuthLayer));

export const getPostsByTag = createServerFn()
  .inputValidator((input: unknown) => postByTagSchema.parse(input))
  .handler(createHandler(getPostsByTagEffect, PostsServiceLive));
