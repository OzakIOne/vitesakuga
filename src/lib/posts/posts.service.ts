import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Exit, Layer, Option, Schema } from "effect";
import type { Expression, ExpressionBuilder, SqlBool } from "kysely";
import { postsSelectSchema } from "src/lib/db/schema";

import { ensureOwnedOrStaff } from "../auth/ownership";
import { getUserRole } from "../auth/policy";
import { SessionFetchError, SessionService } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import type { DB } from "../db/kysely";
import type { postSourceSchema, PostWithVotes } from "../db/schema";
import { SqlError, SqlNoFirstResult } from "../effect/effect.utils";
import { parse, parseStrict } from "../effect/schema.utils";
import {
  ForbiddenError,
  PostNotFoundError,
  RowParseError,
  UnauthorizedError,
  ValidationError,
} from "../errors";
import { asPostId, PostId } from "../ids";
import {
  computePagination,
  type PaginationMeta,
} from "../pagination/pagination";
import { PointsService, PointsServiceLive } from "../points/points.service";
import { baseLayerFactories, createHandler } from "../server-fn.handler";
import { videoContentType } from "../storage/content-type";
import { pendingVideoPrefix } from "../storage/keys";
import { StorageError, StorageModule } from "../storage/storage.module";
import { isUploadedVideoValid } from "../storage/upload-policy";
import { fetchPopularTagsForPosts, mapPopularTags } from "../tags/tags.utils";
import { mergeVoteCounts } from "../votes/votes.utils";
import {
  assertSupportedImageFile,
  assertThumbnailIsJpeg,
} from "./file-validation";
import {
  createVideoUploadUrlSchema,
  FormFileUploadSchema,
  MAX_VIDEO_SIZE_BYTES,
  postByTagSchema,
  RESERVED_TAG_NAMES,
  searchPostsBaseSchema,
  updatePostInputSchema,
  VideoMetadataSchema,
} from "./posts.schema";
import { escapeLikePattern } from "./search-pattern";

const PAGE_SIZE = 30;

// oxlint-disable effecttsgo/global-date -- calendar-day boundaries use the server's local timezone so "today"/"this week" match user expectations; Effect DateTime has no local-midnight equivalent
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
// oxlint-enable effecttsgo/global-date

type PostsSearchResult = {
  readonly data: readonly PostWithVotes[];
  meta: {
    pagination: PaginationMeta;
    popularTags: ReturnType<typeof mapPopularTags>;
  };
};

type PostDetailResult = {
  post: {
    animeTitle: string | null;
    content: string;
    createdAt: Date;
    episodeNumber: number | null;
    id: PostId;
    relatedPostId: PostId | null;
    seasonNumber: number | null;
    source: string | null;
    sourceType: Schema.Schema.Type<typeof postSourceSchema> | null;
    title: string;
    videoKey: string | null;
    videoMetadata: Schema.Schema.Type<typeof VideoMetadataSchema>;
  };
  images: string[];
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
      postId: PostId,
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
      SessionService
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
      SessionService
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
      SessionService
    >;
    readonly getByTag: (
      data: Schema.Schema.Type<typeof postByTagSchema>,
    ) => Effect.Effect<PostsSearchResult, SqlError | RowParseError>;
  }
>()("PostsService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;
    const storage = yield* StorageModule;
    const points = yield* PointsService;

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

      const parsedWithVotes = yield* mergeVoteCounts(db, parsed);

      const popularTagsPredicates: ((
        eb: ExpressionBuilder<DB, "posts">,
      ) => Expression<SqlBool>)[] = [];
      if (q) {
        const pattern = `%${escapeLikePattern(q)}%`;
        popularTagsPredicates.push((eb) =>
          eb.or([
            eb("posts.title", "ilike", pattern),
            eb("posts.content", "ilike", pattern),
          ]),
        );
      }

      if (dateRange !== "all") {
        popularTagsPredicates.push((eb) =>
          eb("posts.createdAt", ">=", computeStartDate(dateRange)),
        );
      }

      const popularTags = yield* fetchPopularTagsForPosts(
        db,
        popularTagsPredicates,
      );

      return {
        data: parsedWithVotes,
        meta: {
          pagination,
          popularTags,
        },
      };
    });

    const fetchDetail = Effect.fn("PostsService.fetchDetail")(function* (
      postId: PostId,
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
            "posts.animeTitle",
            "posts.seasonNumber",
            "posts.episodeNumber",
            "posts.sourceType",
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
          .where("post_tags.postId", "=", postWithUser.id)
          // Reserved media-kind tags are managed by the server; users never
          // see or edit them in the tag UI.
          .where("tags.name", "not in", [...RESERVED_TAG_NAMES])
          .orderBy("tags.name", "asc"),
      );

      const imageRows = yield* db.execute(
        db
          .selectFrom("post_images")
          .select(["post_images.position", "post_images.storageKey"])
          .where("postId", "=", postWithUser.id)
          .orderBy("position", "asc"),
      );

      // SAFETY: relatedPostId is a posts.id foreign key column; the row value
      // is coerced to the branded type the FK relationship guarantees.
      const relatedPostOption = postWithUser.relatedPostId
        ? yield* db.executeTakeFirstOption(
            db
              .selectFrom("posts")
              .selectAll()
              .where("id", "=", asPostId(postWithUser.relatedPostId as number)),
          )
        : Option.none();

      const relatedPost = Option.match(relatedPostOption, {
        onNone: () => null,
        // Full posts row: run it through the select schema so its identity
        // fields come out branded, consistent with every other post payload.
        onSome: (row) => parse(postsSelectSchema)(row),
      });

      return {
        post: {
          animeTitle: postWithUser.animeTitle,
          content: postWithUser.content,
          createdAt: postWithUser.createdAt,
          // SAFETY: posts.id is the table's primary key.
          id: asPostId(postWithUser.id),
          // SAFETY: relatedPostId is a posts.id FK column; the row value
          // satisfies the PostId contract by construction.
          relatedPostId: postWithUser.relatedPostId
            ? asPostId(postWithUser.relatedPostId as number)
            : null,
          source: postWithUser.source,
          title: postWithUser.title,
          videoKey: postWithUser.videoKey,
          videoMetadata: parse(VideoMetadataSchema)(postWithUser.videoMetadata),
          seasonNumber: postWithUser.seasonNumber,
          episodeNumber: postWithUser.episodeNumber,
          sourceType: postWithUser.sourceType,
        },
        images: imageRows.map((row) => row.storageKey),
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
      const sessions = yield* SessionService;
      const user = yield* sessions.requireUser(
        "You must be logged in to upload a post",
      );

      const userId = user.id;

      const {
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
          mediaKind: videoKey === undefined ? "image" : "video",
          title,
          userId,
        }),
      );

      let finalVideoKey: string | null = null;

      // Only keys from the caller's own staging namespace are acceptable:
      // presigned PUTs land under `videos/_pending/{userId}/` and are
      // promoted to their final key below, after validation.
      if (videoKey !== undefined) {
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
        finalVideoKey = promotedVideoKey;
      }

      // Rollback list: every stored object is deleted if any later step
      // fails, so storage stays in sync with the DB. The promoted video key
      // was validated before this point, images/thumbnails upload below.
      const uploadedKeys: string[] = [];
      if (finalVideoKey !== null) {
        uploadedKeys.push(finalVideoKey);
      }

      const outcome = yield* Effect.gen(function* () {
        let thumbnailKey: string;
        const imageKeys: string[] = [];

        if (data.images !== undefined && data.images.length > 0) {
          for (const image of data.images) {
            const { key } = yield* storage.uploadImage(userId, image);
            uploadedKeys.push(key);
            imageKeys.push(key);
          }
          // The first image doubles as the card thumbnail so grids and
          // playlists keep working without knowing about post_images.
          thumbnailKey = imageKeys[0] ?? "";
        } else {
          if (data.thumbnail === undefined) {
            return yield* Effect.fail(
              new ValidationError({ message: "Thumbnail is required" }),
            );
          }
          const thumb = yield* storage.uploadThumbnail(userId, data.thumbnail);
          thumbnailKey = thumb.key;
          uploadedKeys.push(thumbnailKey);
        }

        const newPost = yield* db.executeTakeFirstOrError(
          db
            .insertInto("posts")
            .values({
              animeTitle: data.animeTitle ? data.animeTitle : null,
              content,
              episodeNumber: data.episodeNumber ?? null,
              relatedPostId,
              seasonNumber: data.seasonNumber ?? null,
              source,
              sourceType: data.sourceType ?? null,
              thumbnailKey,
              title,
              userId,
              videoKey: finalVideoKey,
              videoMetadata:
                videoMetadata === undefined
                  ? "{}"
                  : Schema.encodeSync(
                      Schema.fromJsonString(VideoMetadataSchema),
                    )(videoMetadata),
            })
            .returningAll(),
        );

        const postId = asPostId(newPost.id);

        if (imageKeys.length > 0) {
          yield* db.execute(
            db.insertInto("post_images").values(
              imageKeys.map((storageKey, index) => ({
                postId,
                position: index,
                storageKey,
              })),
            ),
          );
        }

        // Strip reserved tag names from user input, then append the correct
        // one so every post always carries its implicit media-kind tag.
        const reservedNames: ReadonlySet<string> = new Set(RESERVED_TAG_NAMES);
        const effectiveTags = [
          ...tags.filter((tag) => !reservedNames.has(tag.name)),
          { name: finalVideoKey === null ? "image" : "video" },
        ];
        yield* resolveAndLinkTags(db, postId, effectiveTags);
        yield* Effect.logInfo("Tags linked to post").pipe(
          Effect.annotateLogs({
            postId: String(postId),
            tagCount: effectiveTags.length,
          }),
        );

        yield* Effect.logInfo("Upload completed").pipe(
          Effect.annotateLogs("postId", String(postId)),
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
      }).pipe(
        Effect.tap((parsed) =>
          points.awardOrLog({
            userId,
            action: "post-upload",
            refId: parsed.id,
            actorId: userId,
          }),
        ),
      );
    });

    const createVideoUploadUrl = Effect.fn("PostsService.createVideoUploadUrl")(
      function* (data: Schema.Schema.Type<typeof createVideoUploadUrlSchema>) {
        const sessions = yield* SessionService;
        const user = yield* sessions.requireUser(
          "You must be logged in to upload a post",
        );

        const ext = data.fileName.split(".").pop() ?? "";
        return yield* storage.presignVideoUpload(user.id, ext);
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

      const parsedWithVotes = yield* mergeVoteCounts(db, parsed);

      const popularTags = yield* fetchPopularTagsForPosts(db, [
        (eb) =>
          eb("posts.id", "in", (eb2) =>
            eb2
              .selectFrom("posts")
              .innerJoin("post_tags", "post_tags.postId", "posts.id")
              .innerJoin("tags", "tags.id", "post_tags.tagId")
              .where("tags.name", "=", tagName)
              .select("posts.id"),
          ),
      ]);

      return {
        data: parsedWithVotes,
        meta: {
          pagination,
          popularTags,
        },
      };
    });

    const update = Effect.fn("PostsService.update")(function* (
      data: Schema.Schema.Type<typeof updatePostInputSchema>,
    ) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireUser(
        "You must be logged in to update a post",
      );

      const { postId, title, content, source, relatedPostId, tags } = data;

      yield* Effect.logInfo("Post update started").pipe(
        Effect.annotateLogs({
          postId: String(postId),
          userId: user.id,
        }),
      );

      const postOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("posts")
          .select(["id", "userId"])
          .where("id", "=", postId),
      );

      yield* ensureOwnedOrStaff({
        resource: postOption,
        selectOwnerId: (row) => row.userId,
        userId: user.id,
        userRole: getUserRole(user),
        notFound: new PostNotFoundError({
          message: `Post ${postId} not found`,
          postId,
        }),
        forbidden: new ForbiddenError({
          message: "You can only update your own posts",
        }),
      });

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

      // Tag links are rebuilt wholesale: delete-then-relink. Reserved media
      // tags ("video"/"image") are stripped from user input and re-applied
      // server-side so every post keeps its implicit media-kind tag.
      yield* db.execute(
        db.deleteFrom("post_tags").where("postId", "=", postId),
      );
      const imageRow = yield* db.executeTakeFirstOrUndefined(
        db
          .selectFrom("post_images")
          .select("postId")
          .where("postId", "=", postId)
          .limit(1),
      );
      const reservedNames: ReadonlySet<string> = new Set(RESERVED_TAG_NAMES);
      const userTags = (tags ?? []).filter(
        (tag) => !reservedNames.has(tag.name),
      );
      yield* resolveAndLinkTags(db, postId, [
        ...userTags,
        { name: imageRow ? "image" : "video" },
      ]);

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
    function* (postId: PostId) {
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
  postId: PostId,
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

export const PostsServiceLive = Layer.effect(
  PostsService,
  PostsService.make,
).pipe(Layer.provideMerge(PointsServiceLive));

export const searchPosts = createServerFn({ strict: { output: false } })
  .validator(parseStrict(searchPostsBaseSchema))
  .handler(
    createHandler(PostsServiceLive, baseLayerFactories.db)(PostsService.search),
  );

export const fetchPostDetail = createServerFn({ strict: { output: false } })
  // Scalar payloads stay unbranded on the wire (see fetchComments pattern).
  .validator(parse(Schema.Number))
  .handler(
    createHandler(
      PostsServiceLive,
      baseLayerFactories.db,
    )((postId: number) => PostsService.fetchDetail(asPostId(postId))),
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
    // Multiple files arrive as repeated "images" entries, which
    // Object.fromEntries collapses to the last one — collect them explicitly.
    const imageFiles = data
      .getAll("images")
      .filter((entry): entry is File => entry instanceof File);
    // SAFETY: the object deliberately mixes arbitrary FormData keys (validated
    // away by the strict schema) with the known fields; the inferred value
    // type is a string-keyed map whose values are validated downstream.
    // SAFETY: the object deliberately mixes arbitrary FormData keys (validated
    // away by the strict schema) with the known fields; the inferred value
    // type is a string-keyed map whose values are validated downstream.
    // The images key is only added when files exist: `optionalKey` rejects an
    // explicit `undefined` value, which would fail the strict parse below.
    const normalized = {
      ...raw,
      tags,
      videoMetadata,
      ...(imageFiles.length > 0 && { images: imageFiles }),
    };
    const parsed = parseStrict(FormFileUploadSchema)(normalized);
    // Magic-byte checks need reading file bytes, so they run here before any
    // storage/DB work: supported-image bytes for image posts, JPEG bytes for
    // generated video thumbnails.
    if (parsed.images !== undefined && parsed.images.length > 0) {
      for (const image of parsed.images) {
        await assertSupportedImageFile(image);
      }
    } else {
      // SAFETY: the schema filter rejects video-less payloads, so reaching
      // this branch means the post carries a video key and its thumbnail.
      await assertThumbnailIsJpeg(parsed.thumbnail as File);
    }
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
