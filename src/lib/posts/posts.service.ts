import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Exit, Layer, Option, Schema } from "effect";
import { postsSelectSchema } from "src/lib/db/schema";

import type { AuthServices } from "../auth/context";
import { getSessionEffect, SessionFetchError } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { postWithVotesSelectSchema, type PostWithVotes } from "../db/schema";
import { SqlError, SqlNoFirstResult } from "../effect/effect.utils";
import { parse, parseStrict } from "../effect/schema.utils";
import {
  ForbiddenError,
  PostNotFoundError,
  RowParseError,
  UnauthorizedError,
  ValidationError,
} from "../errors";
import {
  computePagination,
  type PaginationMeta,
} from "../pagination/pagination";
import { baseLayerFactories, createHandler } from "../server-fn.handler";
import { videoContentType } from "../storage/content-type";
import { pendingVideoPrefix } from "../storage/keys";
import { StorageError, StorageModule } from "../storage/storage.module";
import { isUploadedVideoValid } from "../storage/upload-policy";
import { mapPopularTags } from "../tags/tags.utils";
import { fetchPostVoteCounts } from "../votes/votes.utils";
import { assertThumbnailIsJpeg } from "./file-validation";
import {
  createVideoUploadUrlSchema,
  FormFileUploadSchema,
  MAX_VIDEO_SIZE_BYTES,
  postByTagSchema,
  searchPostsBaseSchema,
  updatePostInputSchema,
  VideoMetadataSchema,
} from "./posts.schema";
import { escapeLikePattern } from "./search-pattern";

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

export const parsePostId = parse(
  Schema.Union([Schema.Number, Schema.NumberFromString]),
);

type PostsSearchResult = {
  readonly data: readonly PostWithVotes[];
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
    ) => Effect.Effect<PostsSearchResult, SqlError | RowParseError>;
    readonly fetchDetail: (
      postId: number,
    ) => Effect.Effect<PostDetailResult, SqlError | PostNotFoundError>;
    readonly upload: (
      data: Schema.Schema.Type<typeof FormFileUploadSchema>,
    ) => Effect.Effect<
      Schema.Schema.Type<typeof postsSelectSchema>,
      | SqlError
      | SqlNoFirstResult
      | StorageError
      | UnauthorizedError
      | SessionFetchError
      | ValidationError
      | RowParseError,
      AuthServices
    >;
    readonly createVideoUploadUrl: (
      data: Schema.Schema.Type<typeof createVideoUploadUrlSchema>,
    ) => Effect.Effect<
      {
        readonly contentType: string;
        readonly key: string;
        readonly url: string;
      },
      StorageError | UnauthorizedError | SessionFetchError,
      AuthServices
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
      | RowParseError,
      AuthServices
    >;
    readonly getByTag: (
      data: Schema.Schema.Type<typeof postByTagSchema>,
    ) => Effect.Effect<PostsSearchResult, SqlError | RowParseError>;
  }
>()("PostsService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;
    const storage = yield* StorageModule;

    const parseWithVotes = Effect.fn("PostsService.parseWithVotes")(function* (
      parsed: readonly Schema.Schema.Type<typeof postsSelectSchema>[],
    ) {
      const voteCounts = yield* fetchPostVoteCounts(
        db,
        parsed.map((post) => post.id),
      );
      const withVotes = parsed.map((post) => {
        const counts = voteCounts.get(post.id) ?? { dislikes: 0, likes: 0 };
        return { ...post, dislikes: counts.dislikes, likes: counts.likes };
      });

      return yield* Effect.try({
        try: () => parse(Schema.Array(postWithVotesSelectSchema))(withVotes),
        catch: (error) =>
          new RowParseError({
            message: `Error processing vote counts: ${String(error)}`,
            cause: error,
          }),
      });
    });

    const search = Effect.fn("PostsService.search")(function* (
      data: Schema.Schema.Type<typeof searchPostsBaseSchema>,
    ) {
      const { q, tags, page, sortBy, dateRange } = data;

      let query = db.selectFrom("posts").selectAll("posts");

      if (q) {
        const pattern = `%${escapeLikePattern(q)}%`;
        query = query.where((eb) =>
          eb("posts.title", "ilike", pattern).or(
            "posts.content",
            "ilike",
            pattern,
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
          new RowParseError({
            message: `Error processing search results: ${String(error)}`,
          }),
      });

      const parsedWithVotes = yield* parseWithVotes(parsed);

      let popularTagsQuery = db
        .selectFrom("tags")
        .innerJoin("post_tags", "tags.id", "post_tags.tagId")
        .innerJoin("posts", "posts.id", "post_tags.postId");

      if (q) {
        const pattern = `%${escapeLikePattern(q)}%`;
        popularTagsQuery = popularTagsQuery.where((eb) =>
          eb("posts.title", "ilike", pattern).or(
            "posts.content",
            "ilike",
            pattern,
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
        data: parsedWithVotes,
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

      // SAFETY: relatedPostId is a DB foreign key column typed as number in the
      // schema; the query param asserts it against the posts.id column type.
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
      const session = yield* getSessionEffect();

      if (!session?.user) {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: "You must be logged in to upload a post",
          }),
        );
      }

      const userId = session.user.id;

      const {
        thumbnail,
        title,
        content,
        source,
        relatedPostId,
        tags,
        videoMetadata,
        videoKey,
      } = data;

      yield* Effect.logInfo("Upload started").pipe(
        Effect.annotateLogs({
          title,
          userId,
          videoKey,
        }),
      );

      // Only keys from the caller's own staging namespace are acceptable:
      // presigned PUTs land under `videos/_pending/{userId}/` and are
      // promoted to their final key below, after validation.
      if (!videoKey.startsWith(pendingVideoPrefix(userId))) {
        return yield* Effect.fail(
          new ValidationError({ message: "Invalid video upload key" }),
        );
      }

      const ext = videoKey.split(".").pop() ?? "";
      const expectedContentType = videoContentType(ext);
      const head = yield* storage.headFile(videoKey).pipe(
        Effect.mapError(
          (error) =>
            new ValidationError({
              cause: error,
              message: `Video upload could not be verified: ${error.message}`,
            }),
        ),
      );

      if (!isUploadedVideoValid(head, expectedContentType)) {
        yield* storage.deleteFile(videoKey).pipe(Effect.ignore);
        return yield* Effect.fail(
          new ValidationError({
            message: `Video upload is invalid: expected ${expectedContentType}, at most ${MAX_VIDEO_SIZE_BYTES / (1024 * 1024)} MB`,
          }),
        );
      }

      // Promote the validated upload out of the staging namespace so only
      // confirmed objects live under `videos/{userId}/`; anything abandoned
      // in staging expires via the bucket lifecycle rule.
      const { key: promotedVideoKey } = yield* storage
        .finalizeVideoUpload(videoKey)
        .pipe(
          Effect.mapError(
            (error) =>
              new ValidationError({
                cause: error,
                message: `Video upload could not be promoted: ${error.message}`,
              }),
          ),
        );

      // The thumbnail still transits the Worker. If any later step fails,
      // roll the uploaded objects back so storage stays in sync with the DB.
      const uploadedKeys: string[] = [];

      const outcome = yield* Effect.gen(function* () {
        uploadedKeys.push(promotedVideoKey);
        const { key: thumbnailKey } = yield* storage.uploadThumbnail(
          userId,
          thumbnail,
        );
        uploadedKeys.push(thumbnailKey);

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
              videoKey: promotedVideoKey,
              videoMetadata:
                videoMetadata === undefined
                  ? "{}"
                  : Schema.encodeSync(
                      Schema.fromJsonString(VideoMetadataSchema),
                    )(videoMetadata),
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
      }).pipe(Effect.exit);

      if (Exit.isFailure(outcome)) {
        yield* Effect.forEach(uploadedKeys, (key) =>
          storage.deleteFile(key).pipe(Effect.ignore),
        ).pipe(Effect.ignore);

        return yield* Effect.failCause(outcome.cause);
      }

      return yield* Effect.try({
        try: () => parse(postsSelectSchema)(outcome.value),
        catch: (error) =>
          new RowParseError({
            message: "There was an error processing the upload result",
            cause: error,
          }),
      });
    });

    const createVideoUploadUrl = Effect.fn("PostsService.createVideoUploadUrl")(
      function* (data: Schema.Schema.Type<typeof createVideoUploadUrlSchema>) {
        const session = yield* getSessionEffect();

        if (!session?.user) {
          return yield* Effect.fail(
            new UnauthorizedError({
              message: "You must be logged in to upload a post",
            }),
          );
        }

        const ext = data.fileName.split(".").pop() ?? "";
        return yield* storage.presignVideoUpload(session.user.id, ext);
      },
    );

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
          new RowParseError({
            message: `Error processing posts by tag: ${String(error)}`,
          }),
      });

      const parsedWithVotes = yield* parseWithVotes(parsed);

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
        data: parsedWithVotes,
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
          new RowParseError({
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
      createVideoUploadUrl,
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

  static readonly createVideoUploadUrl = Effect.fn(
    "PostsService.createVideoUploadUrl",
  )(function* (data: Schema.Schema.Type<typeof createVideoUploadUrlSchema>) {
    const svc = yield* PostsService;
    return yield* svc.createVideoUploadUrl(data);
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
  .validator(parseStrict(searchPostsBaseSchema))
  .handler(
    createHandler(PostsServiceLive, baseLayerFactories.db)(PostsService.search),
  );

export const fetchPostDetail = createServerFn({ strict: { output: false } })
  .validator(parsePostId)
  .handler(
    createHandler(
      PostsServiceLive,
      baseLayerFactories.db,
    )(PostsService.fetchDetail),
  );

export const uploadPost = createServerFn({ method: "POST" })
  // oxlint-disable-next-line effecttsgo/async-function -- server-fn validators are the sanctioned pre-handler boundary; the JPEG magic-byte check needs async File I/O, which Effect cannot express in a validator.
  .validator(async (data: FormData) => {
    const raw = Object.fromEntries(data.entries());
    // SAFETY: raw["tags"] is a JSON string field in the multipart form; the
    // schema re-validates the parsed value against FormFileUploadSchema.
    const tags = raw["tags"] ? JSON.parse(raw["tags"] as string) : [];
    // SAFETY: raw["videoMetadata"] is a JSON string field in the multipart form;
    // the schema re-validates the parsed value against FormFileUploadSchema.
    const videoMetadata = raw["videoMetadata"]
      ? JSON.parse(raw["videoMetadata"] as string)
      : undefined;
    // SAFETY: the object deliberately mixes arbitrary FormData keys (validated
    // away by the strict schema) with the four known fields; the inferred
    // value type is a string-keyed map whose values are validated downstream.
    const normalized = {
      relatedPostId: undefined,
      source: undefined,
      ...raw,
      tags,
      videoMetadata,
    };
    const parsed = parseStrict(FormFileUploadSchema)(normalized);
    // Extension/size checks are sync in the schema; the JPEG magic-byte check
    // requires reading file bytes, so it runs here before any storage/DB work.
    await assertThumbnailIsJpeg(parsed.thumbnail);
    return parsed;
  })
  .handler(
    createHandler(
      PostsServiceLive,
      baseLayerFactories.auth,
    )(PostsService.upload),
  );

export const createVideoUploadUrl = createServerFn({ method: "POST" })
  .validator(parseStrict(createVideoUploadUrlSchema))
  .handler(
    createHandler(
      PostsServiceLive,
      baseLayerFactories.auth,
    )(PostsService.createVideoUploadUrl),
  );

export const updatePost = createServerFn({ method: "POST" })
  .validator(parseStrict(updatePostInputSchema))
  .handler(
    createHandler(
      PostsServiceLive,
      baseLayerFactories.auth,
    )(PostsService.update),
  );
