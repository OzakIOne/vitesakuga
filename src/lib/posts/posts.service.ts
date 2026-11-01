import { createServerFn } from "@tanstack/react-start";
import { Clock, Context, Effect, Exit, Layer, Option, Schema } from "effect";
import { sql, type Selectable } from "kysely";
import { postsSelectSchema } from "src/lib/db/schema";

import {
  CommunityActivityService,
  CommunityActivityServiceLive,
} from "../activity/community-activity.service";
import { authorize, authorizeOwned } from "../auth/policy";
import { SessionFetchError, SessionService } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import {
  SqlError,
  SqlNoFirstResult,
  type EffectTransaction,
} from "../db/effect-kysely";
import type { DB } from "../db/kysely";
import type { postSourceSchema, PostWithVotes } from "../db/schema";
import { toIsoTimestamp } from "../db/schema/timestamp";
import { parse, parseStrict } from "../effect/schema.utils";
import {
  ForbiddenError,
  PostNotFoundError,
  RowParseError,
  UnauthorizedError,
  ValidationError,
} from "../errors";
import { asPostId, PostId } from "../ids";
import { FingerprintInputError } from "../lifecycle/fingerprint";
import {
  LifecycleService,
  updatePostWithVersionInTransaction,
  LifecycleServiceLive,
  type LifecycleError,
  type ObjectFenceInput,
  type StagedVideo,
} from "../lifecycle/lifecycle.service";
import type { PaginationMeta } from "../pagination/pagination";
import { createEndpointHandler } from "../server-endpoint";
import { baseLayerFactories } from "../server-fn.handler";
import { imageContentType, videoContentType } from "../storage/content-type";
import {
  imageObjectKey,
  pendingVideoObjectKey,
  thumbnailObjectKey,
} from "../storage/keys";
import { StorageError, StorageModule } from "../storage/storage.module";
import type { mapPopularTags } from "../tags/tags.utils";
import { mergeVoteCounts } from "../votes/votes.utils";
import {
  assertSupportedImageFile,
  assertThumbnailIsJpeg,
} from "./file-validation";
import {
  dateRangePredicate,
  excludedTagsPredicate,
  fetchPostPage,
  includedTagsPredicate,
  numericFilterPredicate,
  rankingExpressions,
  seriesTitlePredicate,
  textPredicate,
  viewScope,
  type PostOrdering,
  type PostScope,
} from "./post-page-query";
import {
  createVideoUploadUrlSchema,
  type DiscoveryView,
  FormFileUploadSchema,
  postByTagSchema,
  RESERVED_TAG_NAMES,
  randomPostSchema,
  searchPostsRequestSchema,
  seriesHubSchema,
  type SearchPostsRequest,
  type SeriesSourceType,
  updatePostInputSchema,
  VideoMetadataSchema,
} from "./posts.schema";
import { parseSearchQuery } from "./search-filters";

const fileDigest = (file: File): Effect.Effect<string, FingerprintInputError> =>
  Effect.tryPromise({
    try: async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return `sha256:${Array.from(new Uint8Array(digest), (value) =>
        value.toString(16).padStart(2, "0"),
      ).join("")}`;
    },
    catch: (cause) =>
      new FingerprintInputError({
        message: `Failed to fingerprint media file: ${String(cause)}`,
      }),
  });

type PostUpdateChanges = {
  animeTitle: string | null;
  chapterNumber: number | null;
  description: string;
  episodeNumber: number | null;
  relatedPostId?: number | null;
  seasonNumber: number | null;
  source?: string | null;
  sourceType: SeriesSourceType | null;
  title: string;
  volumeNumber: number | null;
};

const viewOrdering = ({
  now,
  randomSeed,
  sortBy,
  view,
}: {
  now: Date;
  randomSeed: number;
  sortBy: SearchPostsRequest["params"]["sortBy"];
  view: DiscoveryView;
}): PostOrdering => {
  const { allTimeLikes, recentDislikes, recentLikes } = rankingExpressions(now);
  switch (view) {
    case "most-liked":
      return (query) =>
        query
          .orderBy(recentLikes, "desc")
          .orderBy("posts.createdAt", "desc")
          .orderBy("posts.id", "desc");
    case "random-study":
      return (query) =>
        query
          .orderBy(randomOrderExpression(randomSeed), "asc")
          .orderBy("posts.id", "asc");
    case "trending":
      return (query) =>
        query
          .orderBy(sql<number>`${recentLikes} - ${recentDislikes}`, "desc")
          .orderBy(recentLikes, "desc")
          .orderBy("posts.createdAt", "desc")
          .orderBy("posts.id", "desc");
    case "under-seen":
      return (query) =>
        query
          .orderBy(allTimeLikes, "asc")
          .orderBy("posts.createdAt", "desc")
          .orderBy("posts.id", "desc");
    case "followed-tags":
      return (query) =>
        query.orderBy("posts.createdAt", "desc").orderBy("posts.id", "desc");
    case "chronological":
      return (query) =>
        query
          .orderBy("posts.createdAt", sortBy === "oldest" ? "asc" : "desc")
          .orderBy("posts.id", sortBy === "oldest" ? "asc" : "desc");
  }
};

const randomOrderExpression = (seed: number) =>
  sql<string>`md5(concat(posts.id, cast(${seed} as text)))`;

type PostsSearchResult = {
  readonly data: readonly PostWithVotes[];
  meta: {
    pagination: PaginationMeta;
    popularTags: ReturnType<typeof mapPopularTags>;
  };
};

type SeriesHubResult = {
  readonly posts: readonly PostWithVotes[];
  readonly title: string;
};

type PostDetailResult = {
  post: {
    animeTitle: string | null;
    chapterNumber: number | null;
    description: string;
    /** ISO timestamp string — `Date` does not survive the JSON server-function transport. */
    createdAt: string;
    episodeNumber: number | null;
    id: PostId;
    relatedPostId: PostId | null;
    seasonNumber: number | null;
    source: string | null;
    sourceType: Schema.Schema.Type<typeof postSourceSchema> | null;
    thumbnailKey: string;
    title: string;
    videoKey: string | null;
    videoMetadata: Schema.Schema.Type<typeof VideoMetadataSchema>;
    version: number;
    volumeNumber: number | null;
  };
  images: string[];
  relatedPost: Schema.Codec.Encoded<typeof postsSelectSchema> | null;
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
      data: SearchPostsRequest,
    ) => Effect.Effect<
      PostsSearchResult,
      SqlError | RowParseError | SessionFetchError,
      SessionService
    >;
    readonly fetchRandomPost: (
      data: Schema.Schema.Type<typeof randomPostSchema>,
    ) => Effect.Effect<PostId | null, SqlError>;
    readonly fetchSeriesHub: (
      data: Schema.Schema.Type<typeof seriesHubSchema>,
    ) => Effect.Effect<SeriesHubResult, SqlError | RowParseError>;
    readonly fetchDetail: (
      postId: number,
    ) => Effect.Effect<PostDetailResult, SqlError | PostNotFoundError>;
    readonly fetchDetailVersion: (
      postId: number,
    ) => Effect.Effect<number, SqlError | PostNotFoundError>;
    readonly upload: (
      data: Schema.Schema.Type<typeof FormFileUploadSchema>,
    ) => Effect.Effect<
      Schema.Schema.Type<typeof postsSelectSchema>,
      | SqlError
      | SqlNoFirstResult
      | StorageError
      | ForbiddenError
      | UnauthorizedError
      | SessionFetchError
      | ValidationError
      | RowParseError
      | FingerprintInputError
      | LifecycleError,
      SessionService
    >;
    readonly createVideoUploadUrl: (
      data: Schema.Schema.Type<typeof createVideoUploadUrlSchema>,
    ) => Effect.Effect<
      {
        readonly contentType: string;
        readonly key: string;
        readonly requiredHeaders: Readonly<Record<string, string>>;
        readonly url: string;
      },
      StorageError | ForbiddenError | UnauthorizedError | SessionFetchError,
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
      | RowParseError
      | ValidationError
      | FingerprintInputError
      | import("../lifecycle/lifecycle.service").LifecycleError,
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
    const lifecycle = yield* LifecycleService;
    const community = yield* CommunityActivityService;

    const validateRelatedPost = Effect.fn("PostsService.validateRelatedPost")(
      function* (args: {
        readonly postId?: PostId | undefined;
        readonly relatedPostId?: PostId | undefined;
      }) {
        if (args.relatedPostId === undefined) {
          return;
        }

        if (args.postId === args.relatedPostId) {
          return yield* Effect.fail(
            new ValidationError({
              message: "A post cannot be related to itself",
            }),
          );
        }

        const relatedPost = yield* db.executeTakeFirstOption(
          db
            .selectFrom("posts")
            .select("id")
            .where("id", "=", args.relatedPostId),
        );
        if (Option.isNone(relatedPost)) {
          return yield* Effect.fail(
            new ValidationError({
              message: `Related post ${args.relatedPostId} not found`,
            }),
          );
        }
      },
    );

    const search = Effect.fn("PostsService.search")(function* (
      data: SearchPostsRequest,
    ) {
      const { includePopularTags } = data;
      const {
        dateRange,
        page,
        randomSeed = 0,
        seriesTitle,
        sortBy,
        tags,
        view = "chronological",
      } = data.params;
      const parsedSearch = parseSearchQuery(data.params.q);
      const { excludedTags, filters, text } = parsedSearch;
      const now = new Date(yield* Clock.currentTimeMillis);
      const sessions = yield* SessionService;
      const viewer =
        view === "followed-tags" ? yield* sessions.getUser() : null;

      const scope: PostScope = [
        ...viewScope({ now, view, viewerId: viewer?.id ?? null }),
        ...(text ? [textPredicate(text)] : []),
        ...(seriesTitle ? [seriesTitlePredicate(seriesTitle)] : []),
        ...(tags.length > 0 ? [includedTagsPredicate(tags)] : []),
        ...(excludedTags.length > 0
          ? [excludedTagsPredicate(excludedTags)]
          : []),
        ...(view === "chronological" && dateRange !== "all"
          ? [dateRangePredicate({ dateRange, now })]
          : []),
        ...filters.map(numericFilterPredicate),
      ];

      return yield* fetchPostPage(db, {
        includePopularTags: includePopularTags && view === "chronological",
        ordering: viewOrdering({ now, randomSeed, sortBy, view }),
        page,
        scope,
      });
    });

    const fetchRandomPost = Effect.fn("PostsService.fetchRandomPost")(
      function* (data: Schema.Schema.Type<typeof randomPostSchema>) {
        const post = yield* db.executeTakeFirstOption(
          db
            .selectFrom("posts")
            .select("posts.id")
            .orderBy(randomOrderExpression(data.randomSeed), "asc")
            .orderBy("posts.id", "asc")
            .limit(1),
        );

        return Option.match(post, {
          onNone: () => null,
          // SAFETY: posts.id is the table's primary key.
          onSome: (row) => asPostId(row.id),
        });
      },
    );

    const fetchSeriesHub = Effect.fn("PostsService.fetchSeriesHub")(function* (
      data: Schema.Schema.Type<typeof seriesHubSchema>,
    ) {
      const seriesTitle = data.seriesTitle.trim();
      const items = yield* db.execute(
        db
          .selectFrom("posts")
          .selectAll("posts")
          // The title from a post link is normally an exact match, while the
          // case-insensitive comparison keeps manually shared URLs useful.
          .where(sql<boolean>`lower("animeTitle") = lower(${seriesTitle})`)
          .orderBy("posts.createdAt", "asc")
          .orderBy("posts.id", "asc"),
      );

      const parsed = yield* Effect.try({
        try: () => parse(Schema.Array(postsSelectSchema))(items),
        catch: (error) =>
          new RowParseError({
            message: `Error processing series results: ${String(error)}`,
          }),
      });
      const posts = yield* mergeVoteCounts(db, parsed);

      return {
        posts,
        title: parsed[0]?.animeTitle ?? seriesTitle,
      };
    });

    const fetchDetail = Effect.fn("PostsService.fetchDetail")(function* (
      rawPostId: number,
    ) {
      const postId = asPostId(rawPostId);
      const postOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("posts")
          .innerJoin("user", "user.id", "posts.userId")
          .select([
            "posts.id",
            "posts.title",
            "posts.description",
            "posts.createdAt",
            "posts.videoKey",
            "posts.source",
            "posts.relatedPostId",
            "posts.videoMetadata",
            "posts.animeTitle",
            "posts.seasonNumber",
            "posts.episodeNumber",
            "posts.chapterNumber",
            "posts.volumeNumber",
            "posts.sourceType",
            "posts.thumbnailKey",
            "posts.version",
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
        // fields come out branded, then re-encode so `createdAt` leaves as
        // an ISO string (the wire format `postsSelectSchema` Encoded promises).
        onSome: (row) =>
          Schema.encodeSync(postsSelectSchema)(parse(postsSelectSchema)(row)),
      });

      return {
        post: {
          animeTitle: postWithUser.animeTitle,
          description: postWithUser.description,
          createdAt: toIsoTimestamp(postWithUser.createdAt),
          // SAFETY: posts.id is the table's primary key.
          id: asPostId(postWithUser.id),
          // SAFETY: relatedPostId is a posts.id FK column; the row value
          // satisfies the PostId contract by construction.
          relatedPostId: postWithUser.relatedPostId
            ? asPostId(postWithUser.relatedPostId as number)
            : null,
          source: postWithUser.source,
          thumbnailKey: postWithUser.thumbnailKey,
          title: postWithUser.title,
          version: postWithUser.version,
          videoKey: postWithUser.videoKey,
          videoMetadata: parse(VideoMetadataSchema)(postWithUser.videoMetadata),
          seasonNumber: postWithUser.seasonNumber,
          episodeNumber: postWithUser.episodeNumber,
          chapterNumber: postWithUser.chapterNumber,
          volumeNumber: postWithUser.volumeNumber,
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

    const parsePostRow = (row: Selectable<DB["posts"]>, message: string) =>
      Effect.try({
        try: () => parse(postsSelectSchema)(row),
        catch: (cause) => new RowParseError({ message, cause }),
      });

    const selectParsedPost = Effect.fn("PostsService.selectParsedPost")(
      function* (postId: number) {
        const row = yield* db.executeTakeFirstOrError(
          db.selectFrom("posts").selectAll().where("id", "=", postId),
        );
        return yield* parsePostRow(
          row,
          "There was an error processing the replay result",
        );
      },
    );

    const upload = Effect.fn("PostsService.upload")(function* (
      data: Schema.Schema.Type<typeof FormFileUploadSchema>,
    ) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireActor(
        "You must be logged in to upload a post",
      );
      yield* authorize({ actor: user, permission: "posts:create" });

      const userId = user.id;
      const operationKey = data.operationKey ?? crypto.randomUUID();
      const fileDigests = [
        ...(data.images === undefined
          ? []
          : yield* Effect.forEach(data.images, (file, index) =>
              fileDigest(file).pipe(
                Effect.map((digest) => ({ digest, slot: `image:${index}` })),
              ),
            )),
        ...(data.thumbnail === undefined
          ? []
          : [
              {
                digest: yield* fileDigest(data.thumbnail),
                slot: "thumbnail",
              },
            ]),
      ];
      return yield* lifecycle.runOperation({
        kind: "post-create",
        operationKey,
        replay: (result) => selectParsedPost(result.postId),
        userId,
        request: {
          fileDigests,
          payload: {
            description: data.description,
            relatedPostId: data.relatedPostId ?? null,
            source: data.source ?? null,
            tags: data.tags.map((tag) => ({
              id: tag.id ?? null,
              name: tag.name,
            })),
            title: data.title,
            videoKey: data.videoKey ?? null,
          },
        },
        run: (operation) =>
          Effect.gen(function* () {
            const claimFence = operation.fence;

            const {
              title,
              description,
              source,
              relatedPostId,
              tags,
              videoMetadata,
              videoKey,
            } = data;

            yield* validateRelatedPost({ relatedPostId });

            yield* Effect.logInfo("Upload started").pipe(
              Effect.annotateLogs({
                mediaKind: videoKey === undefined ? "image" : "video",
                title,
                userId,
              }),
            );

            let stagedVideo: StagedVideo | null = null;
            if (videoKey !== undefined) {
              stagedVideo = yield* lifecycle.verifyStagedVideo({
                operationId: operation.operationId,
                pendingKey: videoKey,
                userId,
              });
            }
            const finalVideoKey = stagedVideo?.finalKey ?? null;

            const uploadedObjects: ObjectFenceInput[] = [];

            const outcome = yield* Effect.gen(function* () {
              let thumbnailKey: string;
              const imageKeys: string[] = [];

              if (stagedVideo !== null) {
                const copied = yield* lifecycle.copyVideoForPost({
                  contentLength: stagedVideo.contentLength,
                  contentType: stagedVideo.contentType,
                  fence: claimFence,
                  fingerprint: stagedVideo.fingerprint,
                  key: stagedVideo.finalKey,
                  kind: "video",
                  operationId: operation.operationId,
                  sourceEtag: stagedVideo.etag,
                  sourceKey: stagedVideo.sourceKey,
                  userId,
                });
                uploadedObjects.push({
                  fence: copied.object.fence,
                  key: copied.object.key,
                  operationId: copied.object.operationId,
                });
              }

              if (data.images !== undefined && data.images.length > 0) {
                for (const [index, image] of data.images.entries()) {
                  const key = imageObjectKey(
                    operation.operationId,
                    index,
                    image.name.split(".").pop() ?? "png",
                  );
                  const extension = image.name.split(".").pop() ?? "png";
                  const contentType = imageContentType(extension);
                  const fingerprint = yield* fileDigest(image);
                  const stored = yield* lifecycle.storeObject({
                    contentLength: image.size,
                    contentType,
                    fence: claimFence,
                    file: image,
                    fingerprint,
                    key,
                    kind: "image",
                    operationId: operation.operationId,
                    userId,
                  });
                  uploadedObjects.push({
                    fence: stored.object.fence,
                    key: stored.object.key,
                    operationId: stored.object.operationId,
                  });
                  imageKeys.push(stored.object.key);
                }
                thumbnailKey = imageKeys[0] ?? "";
              } else {
                if (data.thumbnail === undefined) {
                  return yield* Effect.fail(
                    new ValidationError({ message: "Thumbnail is required" }),
                  );
                }
                const key = thumbnailObjectKey(operation.operationId);
                const fingerprint = yield* fileDigest(data.thumbnail);
                const stored = yield* lifecycle.storeObject({
                  contentLength: data.thumbnail.size,
                  contentType: "image/jpeg",
                  fence: claimFence,
                  file: data.thumbnail,
                  fingerprint,
                  key,
                  kind: "thumbnail",
                  operationId: operation.operationId,
                  userId,
                });
                thumbnailKey = stored.object.key;
                uploadedObjects.push({
                  fence: stored.object.fence,
                  key: stored.object.key,
                  operationId: stored.object.operationId,
                });
              }

              const newPost = yield* db.transaction((trx) =>
                Effect.gen(function* () {
                  const newPost = yield* trx.executeTakeFirstOrError(
                    trx
                      .insertInto("posts")
                      .values({
                        animeTitle: data.animeTitle ? data.animeTitle : null,
                        chapterNumber: data.chapterNumber ?? null,
                        description,
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
                        volumeNumber: data.volumeNumber ?? null,
                      })
                      .returningAll(),
                  );

                  const postId = asPostId(newPost.id);

                  if (imageKeys.length > 0) {
                    yield* trx.execute(
                      trx.insertInto("post_images").values(
                        imageKeys.map((storageKey, index) => {
                          const dimensions = data.imageDimensions?.[index];
                          return {
                            height: dimensions?.height ?? null,
                            postId,
                            position: index,
                            storageKey,
                            width: dimensions?.width ?? null,
                          };
                        }),
                      ),
                    );
                  }

                  // Strip reserved tag names from user input, then append the correct
                  // one so every post always carries its implicit media-kind tag.
                  const reservedNames: ReadonlySet<string> = new Set(
                    RESERVED_TAG_NAMES,
                  );
                  const effectiveTags = [
                    ...tags.filter((tag) => !reservedNames.has(tag.name)),
                    { name: finalVideoKey === null ? "image" : "video" },
                  ];
                  yield* resolveAndLinkTags(trx, postId, effectiveTags);

                  yield* operation.finish(trx, {
                    imageKeys,
                    postId,
                    thumbnailKey,
                    ...(finalVideoKey !== null && { videoKey: finalVideoKey }),
                  });

                  yield* Effect.logInfo("Tags linked to post").pipe(
                    Effect.annotateLogs({
                      postId: String(postId),
                      tagCount: effectiveTags.length,
                    }),
                  );

                  return newPost;
                }),
              );

              yield* Effect.logInfo("Upload completed").pipe(
                Effect.annotateLogs("postId", String(newPost.id)),
              );

              return newPost;
            }).pipe(Effect.exit);

            if (Exit.isFailure(outcome)) {
              yield* Effect.forEach(uploadedObjects, (object) =>
                lifecycle.deleteObject(object).pipe(Effect.ignore),
              ).pipe(Effect.ignore);

              return yield* Effect.failCause(outcome.cause);
            }

            if (stagedVideo !== null) {
              yield* lifecycle.discardStagedVideo(stagedVideo.sourceKey);
            }

            const parsed = yield* parsePostRow(
              outcome.value,
              "There was an error processing the upload result",
            );
            yield* community.record({
              _tag: "PostUploaded",
              authorId: userId,
              postId: parsed.id,
            });
            return parsed;
          }),
      });
    });

    const createVideoUploadUrl = Effect.fn("PostsService.createVideoUploadUrl")(
      function* (data: Schema.Schema.Type<typeof createVideoUploadUrlSchema>) {
        const sessions = yield* SessionService;
        const user = yield* sessions.requireActor(
          "You must be logged in to upload a post",
        );
        yield* authorize({ actor: user, permission: "posts:create" });

        const ext = data.fileName.split(".").pop() ?? "";
        const key = pendingVideoObjectKey(
          user.id,
          data.operationKey ?? crypto.randomUUID(),
          ext,
        );
        return yield* storage.presignDeterministicVideoUpload(
          user.id,
          key,
          videoContentType(ext),
        );
      },
    );

    const getByTag = Effect.fn("PostsService.getByTag")(function* (
      data: Schema.Schema.Type<typeof postByTagSchema>,
    ) {
      const { tag: tagName, page } = data;

      return yield* fetchPostPage(db, {
        includePopularTags: true,
        ordering: (query) => query.orderBy("posts.createdAt", "desc"),
        page,
        scope: [includedTagsPredicate([tagName])],
      });
    });

    const fetchDetailVersion = Effect.fn("PostsService.fetchDetailVersion")(
      function* (rawPostId: number) {
        const postId = asPostId(rawPostId);
        const row = yield* db.executeTakeFirstOption(
          db
            .selectFrom("posts")
            .select(["id", "version"])
            .where("id", "=", postId),
        );
        if (Option.isNone(row)) {
          return yield* new PostNotFoundError({
            message: `Post ${postId} not found`,
            postId,
          });
        }
        return row.value.version;
      },
    );

    const update = Effect.fn("PostsService.update")(function* (
      data: Schema.Schema.Type<typeof updatePostInputSchema>,
    ) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireActor(
        "You must be logged in to update a post",
      );

      const {
        animeTitle,
        chapterNumber,
        description,
        episodeNumber,
        postId,
        relatedPostId,
        seasonNumber,
        source,
        sourceType,
        tags,
        title,
        volumeNumber,
      } = data;

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

      yield* authorizeOwned({
        actor: user,
        resource: postOption,
        selectOwnerId: (row) => row.userId,
        own: "posts:edit-own",
        any: "posts:edit-any",
        notFound: new PostNotFoundError({
          message: `Post ${postId} not found`,
          postId,
        }),
        forbidden: new ForbiddenError({
          message: "You can only update your own posts",
        }),
      });

      yield* validateRelatedPost({ postId, relatedPostId });

      return yield* lifecycle.runOperation({
        kind: "post-update",
        operationKey: data.operationKey,
        replay: (result) => selectParsedPost(result.postId),
        userId: user.id,
        request: {
          payload: {
            animeTitle,
            chapterNumber,
            description,
            episodeNumber,
            postId,
            relatedPostId: relatedPostId ?? null,
            seasonNumber,
            source: source ?? null,
            sourceType,
            tags: tags.map((tag) => ({ id: tag.id ?? null, name: tag.name })),
            title,
            volumeNumber,
          },
          version: data.expectedVersion,
        },
        run: (operation) =>
          Effect.gen(function* () {
            const changes: PostUpdateChanges = {
              animeTitle,
              chapterNumber,
              description,
              episodeNumber,
              seasonNumber,
              sourceType,
              title,
              volumeNumber,
            };
            if (relatedPostId !== undefined)
              changes.relatedPostId = relatedPostId;
            if (source !== undefined) changes.source = source;

            const updatedPost = yield* db.transaction((trx) =>
              Effect.gen(function* () {
                yield* updatePostWithVersionInTransaction(trx, {
                  changes,
                  expectedVersion: data.expectedVersion,
                  ownerUserId: user.id,
                  postId,
                });
                const updatedPost = yield* trx.executeTakeFirstOrError(
                  trx.selectFrom("posts").selectAll().where("id", "=", postId),
                );

                // Tag links are rebuilt wholesale: delete-then-relink. Reserved media
                // tags ("video"/"image") are stripped from user input and re-applied
                // server-side so every post keeps its implicit media-kind tag.
                yield* trx.execute(
                  trx.deleteFrom("post_tags").where("postId", "=", postId),
                );
                const imageRow = yield* trx.executeTakeFirstOrUndefined(
                  trx
                    .selectFrom("post_images")
                    .select("postId")
                    .where("postId", "=", postId)
                    .limit(1),
                );
                const reservedNames: ReadonlySet<string> = new Set(
                  RESERVED_TAG_NAMES,
                );
                const userTags = (tags ?? []).filter(
                  (tag) => !reservedNames.has(tag.name),
                );
                yield* resolveAndLinkTags(trx, postId, [
                  ...userTags,
                  { name: imageRow ? "image" : "video" },
                ]);

                yield* operation.finish(trx, { postId });

                return updatedPost;
              }),
            );

            const updatedPostParsed = yield* parsePostRow(
              updatedPost,
              "There was an error processing the update result",
            );

            yield* Effect.logInfo("Post updated").pipe(
              Effect.annotateLogs("postId", String(postId)),
            );

            return updatedPostParsed;
          }),
      });
    });

    return {
      search,
      fetchRandomPost,
      fetchSeriesHub,
      fetchDetail,
      fetchDetailVersion,
      upload,
      createVideoUploadUrl,
      getByTag,
      update,
    };
  }),
}) {}

const resolveAndLinkTags = Effect.fn("resolveAndLinkTags")(function* (
  db: Pick<
    EffectTransaction<DB>,
    "execute" | "executeTakeFirstOrError" | "insertInto" | "selectFrom"
  >,
  postId: PostId,
  tags: ReadonlyArray<{ id?: number | undefined; name: string }>,
) {
  const tagIds = [
    ...new Set(tags.flatMap((tag) => (tag.id === undefined ? [] : [tag.id]))),
  ];
  if (tagIds.length > 0) {
    const persistedTags = yield* db.execute(
      db.selectFrom("tags").select(["id", "name"]).where("id", "in", tagIds),
    );
    const persistedTagNames = new Map(
      persistedTags.map((tag) => [tag.id, tag.name]),
    );
    for (const tag of tags) {
      if (tag.id !== undefined && persistedTagNames.get(tag.id) !== tag.name) {
        return yield* Effect.fail(
          new ValidationError({ message: "Tag selection is invalid" }),
        );
      }
    }
  }

  const allTagIds: number[] = [];

  // Upserts retain row locks until commit. Every request must acquire them
  // in the same order, even when users submit the same tags in reverse order.
  const orderedTags = [...tags].sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  );
  for (const tag of orderedTags) {
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

  const uniqueTagIds = [...new Set(allTagIds)];
  if (uniqueTagIds.length > 0) {
    yield* db.execute(
      db
        .insertInto("post_tags")
        .values(uniqueTagIds.map((tagId) => ({ postId, tagId }))),
    );
  }
});

export const PostsServiceLive = Layer.effect(
  PostsService,
  PostsService.make,
).pipe(
  Layer.provideMerge(CommunityActivityServiceLive),
  Layer.provideMerge(LifecycleServiceLive),
);

export const searchPosts = createServerFn({ strict: { output: false } })
  .validator(parseStrict(searchPostsRequestSchema))
  .handler(
    createEndpointHandler({
      service: PostsService,
      operation: "search",
      layer: PostsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const fetchRandomPostId = createServerFn({ strict: { output: false } })
  .validator(parseStrict(randomPostSchema))
  .handler(
    createEndpointHandler({
      service: PostsService,
      operation: "fetchRandomPost",
      layer: PostsServiceLive,
      base: baseLayerFactories.db,
    }),
  );

export const fetchSeriesHub = createServerFn({ strict: { output: false } })
  .validator(parseStrict(seriesHubSchema))
  .handler(
    createEndpointHandler({
      service: PostsService,
      operation: "fetchSeriesHub",
      layer: PostsServiceLive,
      base: baseLayerFactories.db,
    }),
  );

export const fetchPostDetailVersion = createServerFn({
  strict: { output: false },
})
  // Scalar payloads stay unbranded on the wire (see fetchComments pattern);
  // the service brands the id on entry.
  .validator(parse(Schema.Number))
  .handler(
    createEndpointHandler({
      service: PostsService,
      operation: "fetchDetailVersion",
      layer: PostsServiceLive,
      base: baseLayerFactories.db,
    }),
  );

export const fetchPostDetail = createServerFn({ strict: { output: false } })
  .validator(parse(Schema.Number))
  .handler(
    createEndpointHandler({
      service: PostsService,
      operation: "fetchDetail",
      layer: PostsServiceLive,
      base: baseLayerFactories.db,
    }),
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
    // SAFETY: FormData scalar entries are strings; this field is JSON encoded
    // by buildFormData and parsed immediately before schema validation.
    const imageDimensions = raw["imageDimensions"]
      ? JSON.parse(raw["imageDimensions"] as string)
      : undefined;
    // Multiple files arrive as repeated "images" entries, which
    // Object.fromEntries collapses to the last one — collect them explicitly.
    const imageFiles = data
      .getAll("images")
      .filter((entry): entry is File => entry instanceof File);
    // SAFETY: the object deliberately mixes arbitrary FormData keys (validated
    // away by the strict schema) with the known fields; the inferred value
    // type is a string-keyed map whose values are validated downstream.
    // The images key is only added when files exist: `optionalKey` rejects an
    // explicit `undefined` value, which would fail the strict parse below.
    const normalized = {
      ...raw,
      imageDimensions,
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
    createEndpointHandler({
      service: PostsService,
      operation: "upload",
      layer: PostsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const createVideoUploadUrl = createServerFn({ method: "POST" })
  .validator(parseStrict(createVideoUploadUrlSchema))
  .handler(
    createEndpointHandler({
      service: PostsService,
      operation: "createVideoUploadUrl",
      layer: PostsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const updatePost = createServerFn({ method: "POST" })
  .validator(parseStrict(updatePostInputSchema))
  .handler(
    createEndpointHandler({
      service: PostsService,
      operation: "update",
      layer: PostsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );
