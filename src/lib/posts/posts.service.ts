import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer, Option, Schema } from "effect";
import { postsSelectSchema } from "src/lib/db/schema";

import { getSessionEffect, SessionFetchError } from "../auth/auth.middleware";
import type { AuthServices } from "../auth/context";
import { KyselyDB } from "../db/context";
import { SqlError, SqlNoFirstResult } from "../effect/effect.utils";
import { parse, parseStrict } from "../effect/schema.utils";
import {
  ForbiddenError,
  PostNotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../errors";
import {
  computePagination,
  type PaginationMeta,
} from "../pagination/pagination";
import { baseLayerFactories, createHandler } from "../server-fn.handler";
import { StorageError, StorageModule } from "../storage/storage.module";
import { mapPopularTags } from "../tags/tags.utils";
import {
  FormFileUploadSchema,
  postByTagSchema,
  searchPostsBaseSchema,
  updatePostInputSchema,
  VideoMetadataSchema,
} from "./posts.schema";

const PAGE_SIZE = 30;

const computeStartDate = (dateRange: "today" | "week" | "month") => {
  const now = new Date();
  if (dateRange === "today") {
    return new Date(now.setHours(0, 0, 0, 0));
  }
  if (dateRange === "week") {
    return new Date(now.setDate(now.getDate() - 7));
  }
  return new Date(now.setMonth(now.getMonth() - 1));
};

export const parsePostId = (postId: unknown) =>
  parse(Schema.Union([Schema.Number, Schema.NumberFromString]))(postId);

type PostsSearchResult = {
  readonly data: readonly Schema.Schema.Type<typeof postsSelectSchema>[];
  meta: {
    pagination: PaginationMeta;
    popularTags: ReturnType<typeof mapPopularTags>;
  };
};

type PostDetailResult = {
  post: {
    content: string;
    createdAt: Date;
    id: number;
    relatedPostId: number | null;
    source: string | null;
    title: string;
    videoKey: string;
    videoMetadata: Schema.Schema.Type<typeof VideoMetadataSchema>;
  };
  relatedPost: Schema.Schema.Type<typeof postsSelectSchema> | null;
  tags: { id: number; name: string }[];
  user: {
    id: string;
    image: string | null;
    name: string;
  };
};

export class PostsService extends Context.Service<
  PostsService,
  {
    readonly search: (
      data: Schema.Schema.Type<typeof searchPostsBaseSchema>,
    ) => Effect.Effect<PostsSearchResult, SqlError | ValidationError>;
    readonly fetchDetail: (
      postId: number,
    ) => Effect.Effect<PostDetailResult, SqlError | PostNotFoundError>;
    readonly upload: (
      data: Schema.Schema.Type<typeof FormFileUploadSchema>,
    ) => Effect.Effect<
      Schema.Schema.Type<typeof postsSelectSchema>,
      SqlError | SqlNoFirstResult | StorageError | ValidationError
    >;
    readonly update: (
      data: Schema.Schema.Type<typeof updatePostInputSchema>,
    ) => Effect.Effect<
      Schema.Schema.Type<typeof postsSelectSchema>,
      | UnauthorizedError
      | ForbiddenError
      | PostNotFoundError
      | SessionFetchError
      | SqlError
      | SqlNoFirstResult
      | ValidationError,
      AuthServices
    >;
    readonly getByTag: (
      data: Schema.Schema.Type<typeof postByTagSchema>,
    ) => Effect.Effect<PostsSearchResult, SqlError | ValidationError>;
  }
>()("PostsService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;
    const storage = yield* StorageModule;

    const search = Effect.fn("PostsService.search")(function* (
      data: Schema.Schema.Type<typeof searchPostsBaseSchema>,
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
        query = query.where(
          "posts.createdAt",
          ">=",
          computeStartDate(dateRange),
        );
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
        try: () => parse(Schema.Array(postsSelectSchema))(items),
        catch: (error) =>
          new ValidationError({
            message: `Error processing search results: ${String(error)}`,
          }),
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
        popularTagsQuery = popularTagsQuery.where(
          "posts.createdAt",
          ">=",
          computeStartDate(dateRange),
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
          videoMetadata: parse(VideoMetadataSchema)(postWithUser.videoMetadata),
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
      data: Schema.Schema.Type<typeof FormFileUploadSchema>,
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

      const post = yield* Effect.try({
        try: () => parse(postsSelectSchema)(newPost),
        catch: (error) =>
          new ValidationError({
            message: "There was an error processing the upload result",
            cause: error,
          }),
      });

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

      return post;
    });

    const getByTag = Effect.fn("PostsService.getByTag")(function* (
      data: Schema.Schema.Type<typeof postByTagSchema>,
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
        try: () => parse(Schema.Array(postsSelectSchema))(items),
        catch: (error) =>
          new ValidationError({
            message: `Error processing posts by tag: ${String(error)}`,
          }),
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
      data: Schema.Schema.Type<typeof updatePostInputSchema>,
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
        Effect.annotateLogs({
          postId: String(postId),
          userId: session.user.id,
        }),
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

      const updatedPostParsed = yield* Effect.try({
        try: () => parse(postsSelectSchema)(updatedPost),
        catch: (error) =>
          new ValidationError({
            message: "There was an error processing the update result",
            cause: error,
          }),
      });

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

      return updatedPostParsed;
    });

    return {
      search,
      fetchDetail,
      upload,
      getByTag,
      update,
    };
  }),
}) {
  static readonly search = Effect.fn("PostsService.search")(function* (
    data: Schema.Schema.Type<typeof searchPostsBaseSchema>,
  ) {
    const svc = yield* PostsService;
    return yield* svc.search(data);
  });

  static readonly fetchDetail = Effect.fn("PostsService.fetchDetail")(
    function* (postId: number) {
      const svc = yield* PostsService;
      return yield* svc.fetchDetail(postId);
    },
  );

  static readonly upload = Effect.fn("PostsService.upload")(function* (
    data: Schema.Schema.Type<typeof FormFileUploadSchema>,
  ) {
    const svc = yield* PostsService;
    return yield* svc.upload(data);
  });

  static readonly getByTag = Effect.fn("PostsService.getByTag")(function* (
    data: Schema.Schema.Type<typeof postByTagSchema>,
  ) {
    const svc = yield* PostsService;
    return yield* svc.getByTag(data);
  });

  static readonly update = Effect.fn("PostsService.update")(function* (
    data: Schema.Schema.Type<typeof updatePostInputSchema>,
  ) {
    const svc = yield* PostsService;
    return yield* svc.update(data);
  });
}

const resolveAndLinkTags = Effect.fn("resolveAndLinkTags")(function* (
  db: KyselyDB["Service"],
  postId: number,
  tags: ReadonlyArray<{ id?: number | undefined; name: string }>,
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

export const PostsServiceLive = Layer.effect(PostsService, PostsService.make);

export const searchPosts = createServerFn({ strict: { output: false } })
  .validator((input: unknown) => parseStrict(searchPostsBaseSchema)(input))
  .handler(createHandler(PostsService.search, PostsServiceLive));

export const fetchPostDetail = createServerFn({ strict: { output: false } })
  .validator(parsePostId)
  .handler(createHandler(PostsService.fetchDetail, PostsServiceLive));

export const uploadPost = createServerFn({ method: "POST" })
  .validator((data: FormData) => {
    const raw = Object.fromEntries(data.entries());
    const tags = raw["tags"] ? JSON.parse(raw["tags"] as string) : [];
    const videoMetadata = raw["videoMetadata"]
      ? JSON.parse(raw["videoMetadata"] as string)
      : undefined;
    const normalized: Record<string, unknown> = {
      relatedPostId: undefined,
      source: undefined,
      ...raw,
      tags,
      videoMetadata,
    };
    return parseStrict(FormFileUploadSchema)(normalized);
  })
  .handler(createHandler(PostsService.upload, PostsServiceLive));

export const updatePost = createServerFn({ method: "POST" })
  .validator((input: unknown) => parseStrict(updatePostInputSchema)(input))
  .handler(
    createHandler(
      PostsService.update,
      PostsServiceLive,
      baseLayerFactories.auth,
    ),
  );

export const getPostsByTag = createServerFn({ strict: { output: false } })
  .validator((input: unknown) => parseStrict(postByTagSchema)(input))
  .handler(createHandler(PostsService.getByTag, PostsServiceLive));
