import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer, Option, Schema } from "effect";
import type { Selectable } from "kysely";
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
import { parse, parseStrict } from "../effect/schema.utils";
import {
  AccountSuspendedError,
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
  LifecycleServiceLive,
  type LifecycleError,
} from "../lifecycle/lifecycle.service";
import { createEndpointHandler } from "../server-endpoint";
import { baseLayerFactories } from "../server-fn.handler";
import { videoContentType } from "../storage/content-type";
import { pendingVideoObjectKey } from "../storage/keys";
import { StorageError, StorageModule } from "../storage/storage.module";
import {
  assertSupportedImageFile,
  assertThumbnailIsJpeg,
} from "./file-validation";
import { applyPostPatchInTransaction } from "./post-patch";
import { PostsReadService, PostsReadServiceLive } from "./posts-read.service";
import {
  createVideoUploadUrlSchema,
  FormFileUploadSchema,
  randomPostSchema,
  RESERVED_TAG_NAMES,
  searchPostsRequestSchema,
  seriesHubSchema,
  type SeriesSourceType,
  updatePostInputSchema,
} from "./posts.schema";

const fileDigest = (file: File): Effect.Effect<string, FingerprintInputError> =>
  Effect.tryPromise({
    try: async () => {
      const bytes = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hex = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      return `sha256:${hex}`;
    },
    catch: () =>
      new FingerprintInputError({
        message: `Could not hash upload file ${file.name}`,
      }),
  });

const validateUploadedMediaFiles = (
  data: Schema.Schema.Type<typeof FormFileUploadSchema>,
): Effect.Effect<void, ValidationError> => {
  if (data.images !== undefined && data.images.length > 0) {
    return Effect.forEach(data.images, (image) =>
      Effect.tryPromise({
        try: () => assertSupportedImageFile(image),
        catch: (error) =>
          new ValidationError({
            message:
              error instanceof Error
                ? error.message
                : "Image must be a valid JPEG, PNG or WebP file",
          }),
      }),
    ).pipe(Effect.asVoid);
  }
  if (data.thumbnail === undefined) {
    return Effect.fail(
      new ValidationError({ message: "Thumbnail is required" }),
    );
  }
  const thumbnail = data.thumbnail;
  return Effect.tryPromise({
    try: () => assertThumbnailIsJpeg(thumbnail),
    catch: (error) =>
      new ValidationError({
        message:
          error instanceof Error
            ? error.message
            : "Thumbnail is not a valid JPEG image",
      }),
  });
};

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

export class PostsService extends Context.Service<
  PostsService,
  {
    readonly upload: (
      data: Schema.Schema.Type<typeof FormFileUploadSchema>,
    ) => Effect.Effect<
      Schema.Schema.Type<typeof postsSelectSchema>,
      | SqlError
      | SqlNoFirstResult
      | StorageError
      | AccountSuspendedError
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
      | StorageError
      | AccountSuspendedError
      | ForbiddenError
      | UnauthorizedError
      | SessionFetchError,
      SessionService
    >;
    readonly update: (
      data: Schema.Schema.Type<typeof updatePostInputSchema>,
    ) => Effect.Effect<
      Schema.Schema.Type<typeof postsSelectSchema>,
      | UnauthorizedError
      | AccountSuspendedError
      | ForbiddenError
      | PostNotFoundError
      | SessionFetchError
      | SqlError
      | SqlNoFirstResult
      | RowParseError
      | ValidationError
      | FingerprintInputError
      | LifecycleError,
      SessionService
    >;
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
      yield* validateUploadedMediaFiles(data);

      const userId = user.id;
      const operationKey = data.operationKey ?? crypto.randomUUID();
      const imagesWithDigest =
        data.images === undefined
          ? undefined
          : yield* Effect.forEach(data.images, (file) =>
              fileDigest(file).pipe(
                Effect.map((fingerprint) => ({ file, fingerprint })),
              ),
            );
      const thumbnailWithDigest =
        data.thumbnail === undefined
          ? undefined
          : {
              file: data.thumbnail,
              fingerprint: yield* fileDigest(data.thumbnail),
            };
      const fileDigests = [
        ...(imagesWithDigest === undefined
          ? []
          : imagesWithDigest.map((image, index) => ({
              digest: image.fingerprint,
              slot: `image:${index}`,
            }))),
        ...(thumbnailWithDigest === undefined
          ? []
          : [
              {
                digest: thumbnailWithDigest.fingerprint,
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

            const newPost = yield* lifecycle.commitPostMedia({
              images: imagesWithDigest,
              operation,
              pendingVideoKey: videoKey,
              thumbnail: thumbnailWithDigest,
              userId,
              commit: (trx, media) =>
                Effect.gen(function* () {
                  const inserted = yield* trx.executeTakeFirstOrError(
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
                        thumbnailKey: media.thumbnailKey,
                        title,
                        userId,
                        videoKey: media.videoKey,
                        videoMetadata: videoMetadata ?? {},
                        volumeNumber: data.volumeNumber ?? null,
                      })
                      .returningAll(),
                  );

                  const postId = asPostId(inserted.id);

                  if (media.imageKeys.length > 0) {
                    yield* trx.execute(
                      trx.insertInto("post_images").values(
                        media.imageKeys.map((storageKey, index) => {
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

                  const reservedNames: ReadonlySet<string> = new Set(
                    RESERVED_TAG_NAMES,
                  );
                  const effectiveTags = [
                    ...tags.filter((tag) => !reservedNames.has(tag.name)),
                    { name: media.videoKey === null ? "image" : "video" },
                  ];
                  yield* resolveAndLinkTags(trx, postId, effectiveTags);

                  yield* operation.finish(trx, {
                    imageKeys: [...media.imageKeys],
                    postId,
                    thumbnailKey: media.thumbnailKey,
                    ...(media.videoKey !== null && {
                      videoKey: media.videoKey,
                    }),
                  });

                  yield* Effect.logInfo("Tags linked to post").pipe(
                    Effect.annotateLogs({
                      postId: String(postId),
                      tagCount: effectiveTags.length,
                    }),
                  );

                  return inserted;
                }),
            });

            yield* Effect.logInfo("Upload completed").pipe(
              Effect.annotateLogs("postId", String(newPost.id)),
            );

            const parsed = yield* parsePostRow(
              newPost,
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

        const ext = data.fileName.split(".").pop()?.toLowerCase() ?? "mp4";
        // Deterministic staging key tied to the caller's operationKey so
        // retries reuse the same staging slot without minting extra keys.
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
                yield* applyPostPatchInTransaction(trx, {
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
      upload,
      createVideoUploadUrl,
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
  const orderedTags = tags.toSorted((left, right) =>
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
      service: PostsReadService,
      operation: "search",
      layer: PostsReadServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const fetchRandomPostId = createServerFn({ strict: { output: false } })
  .validator(parseStrict(randomPostSchema))
  .handler(
    createEndpointHandler({
      service: PostsReadService,
      operation: "fetchRandomPost",
      layer: PostsReadServiceLive,
      base: baseLayerFactories.db,
    }),
  );

export const fetchSeriesHub = createServerFn({ strict: { output: false } })
  .validator(parseStrict(seriesHubSchema))
  .handler(
    createEndpointHandler({
      service: PostsReadService,
      operation: "fetchSeriesHub",
      layer: PostsReadServiceLive,
      base: baseLayerFactories.db,
    }),
  );

export const fetchPostDetailVersion = createServerFn({
  strict: { output: false },
})
  .validator(parse(Schema.Number))
  .handler(
    createEndpointHandler({
      service: PostsReadService,
      operation: "fetchDetailVersion",
      layer: PostsReadServiceLive,
      base: baseLayerFactories.db,
    }),
  );

export const fetchPostDetail = createServerFn({ strict: { output: false } })
  .validator(parse(Schema.Number))
  .handler(
    createEndpointHandler({
      service: PostsReadService,
      operation: "fetchDetail",
      layer: PostsReadServiceLive,
      base: baseLayerFactories.db,
    }),
  );

export const uploadPost = createServerFn({ method: "POST" })
  .validator((data: FormData) => {
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
    const imageFiles = data
      .getAll("images")
      .filter((entry): entry is File => entry instanceof File);
    const normalized = {
      ...raw,
      imageDimensions,
      tags,
      videoMetadata,
      ...(imageFiles.length > 0 && { images: imageFiles }),
    };
    return parseStrict(FormFileUploadSchema)(normalized);
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
