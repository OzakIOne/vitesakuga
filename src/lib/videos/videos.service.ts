import { createServerFn } from "@tanstack/react-start";
import { Clock, Context, Effect, Exit, Layer, Option } from "effect";
import { sql } from "kysely";

import { getUserRole, userHasPermission } from "../auth/policy";
import { roleAtLeast } from "../auth/roles";
import { SessionService } from "../auth/session.effect";
import { SessionFetchError } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { toIsoTimestamp } from "../db/schema/timestamp";
import { SqlError, SqlNoFirstResult } from "../effect/effect.utils";
import {
  ForbiddenError,
  PostNotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../errors";
import {
  operationRequestFingerprint,
  type FingerprintInputError,
} from "../lifecycle/fingerprint";
import {
  LifecycleService,
  LifecycleServiceLive,
  type LifecycleError,
  PostVersionConflictError,
  finishOperationInTransaction,
  markReadyInTransaction,
} from "../lifecycle/lifecycle.service";
import { MAX_VIDEO_SIZE_BYTES } from "../posts/posts.schema";
import { baseLayerFactories, createHandler } from "../server-fn.handler";
import { videoContentType } from "../storage/content-type";
import {
  isDeterministicMediaKey,
  PENDING_VIDEOS_PREFIX,
  pendingVideoPrefix,
  videoObjectKey,
} from "../storage/keys";
import { StorageError, StorageModule } from "../storage/storage.module";
import { isUploadedVideoValid } from "../storage/upload-policy";
import { DAY_MS, REVISION_RETENTION_DAYS } from "./videos.config";

/** A restorable previous version of a post's video. */
export type VideoRevision = {
  /** ISO timestamp string — `Date` does not survive the JSON server-function transport. */
  readonly createdAt: string;
  readonly id: number;
  readonly postId: number;
  readonly replacedBy: string;
  readonly videoKey: string;
};

export type GcPreviewResult = {
  readonly orphanKeys: ReadonlyArray<string>;
  readonly purgeableRevisions: ReadonlyArray<VideoRevision>;
};

export type GcRunResult = {
  readonly deletedKeys: number;
  readonly purgedRevisions: number;
};

type ServiceFailure =
  | FingerprintInputError
  | ForbiddenError
  | PostNotFoundError
  | SessionFetchError
  | SqlError
  | SqlNoFirstResult
  | StorageError
  | UnauthorizedError
  | ValidationError
  | LifecycleError;

// oxlint-disable effecttsgo/global-date -- retention windows and cutoffs compare wall-clock timestamps against Postgres Date rows; Effect DateTime would need the same Date round-trip
const gcCutoffDate = (now: Date): Date =>
  new Date(now.valueOf() - REVISION_RETENTION_DAYS * DAY_MS);

export class VideosService extends Context.Service<
  VideosService,
  {
    /**
     * Replaces a post's video after validating the staged upload. Authors
     * replace their own videos at any rank; non-authors need moderator/admin
     * rank (`videos:replace-any`). The old object is archived as a revision.
     */
    readonly replace: (input: {
      expectedVersion: number;
      operationKey: string;
      pendingVideoKey: string;
      postId: number;
    }) => Effect.Effect<{ videoKey: string }, ServiceFailure, SessionService>;

    /** Restorable revisions of one post (newest first), owner/staff only. */
    readonly listRevisions: (
      postId: number,
    ) => Effect.Effect<
      ReadonlyArray<VideoRevision>,
      ServiceFailure,
      SessionService
    >;

    /**
     * Staff-only: restores a revision's video back onto its post, archiving
     * the currently-live object so the restore itself stays undoable.
     */
    readonly restore: (input: {
      expectedVersion: number;
      operationKey: string;
      revisionId: number;
    }) => Effect.Effect<{ restored: true }, ServiceFailure, SessionService>;

    /**
     * Admin dry-run: expired revisions whose post had no recent report,
     * plus bucket objects under `videos/` nothing references anymore.
     */
    readonly gcPreview: () => Effect.Effect<
      GcPreviewResult,
      ServiceFailure,
      SessionService
    >;

    /**
     * Admin-only: executes what {@link gcPreview} reports. Bucket objects
     * go first; DB rows are removed only for confirmed deletions.
     */
    readonly gcRun: () => Effect.Effect<
      GcRunResult,
      ServiceFailure,
      SessionService
    >;
  }
>()("VideosService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;
    const storage = yield* StorageModule;
    const lifecycle = yield* LifecycleService;

    const STAFF_ONLY_MESSAGE =
      "Only moderators and admins can manage other users' videos.";
    const ADMIN_ONLY_MESSAGE = "Only admins can run storage maintenance.";

    const currentUserWithRank = () =>
      Effect.gen(function* () {
        const sessions = yield* SessionService;
        const user = yield* sessions.requireUser("You must be logged in.");
        return { role: getUserRole(user), userId: user.id };
      });

    const loadPost = (postId: number) =>
      db.executeTakeFirstOption(
        db.selectFrom("posts").selectAll().where("id", "=", postId),
      );

    const revisionsForPost = (postId: number) =>
      db
        .execute(
          db
            .selectFrom("video_revisions")
            .select(["createdAt", "id", "postId", "replacedBy", "videoKey"])
            .where("postId", "=", postId)
            .orderBy("createdAt", "desc"),
        )
        .pipe(
          Effect.map((rows) =>
            rows.map((row) => ({
              ...row,
              createdAt: toIsoTimestamp(row.createdAt),
            })),
          ),
        );

    // oxlint-disable effecttsgo/global-date -- retention windows compare wall-clock timestamps against Postgres rows; Effect DateTime would need the same round-trip

    /**
     * Shared GC analysis. Returns expired revisions whose post had no report
     * inside the retention window, plus bucket objects under `videos/`
     * (excluding staging, which has its own lifecycle rule) that neither a
     * live post nor any retained revision references.
     */
    const analyzeGc = Effect.fn("VideosService.analyzeGc")(function* () {
      // oxlint-disable effecttsgo/global-date-in-effect -- retention windows compare wall-clock timestamps against Postgres Date rows; Effect DateTime would need the same round-trip
      const now = new Date(yield* Clock.currentTimeMillis);
      const cutoff = gcCutoffDate(now);
      const recentReportCutoff = new Date(now.valueOf() - 90 * DAY_MS);
      // oxlint-enable effecttsgo/global-date-in-effect

      const allRevisions = yield* db.execute(
        db.selectFrom("video_revisions").selectAll(),
      );
      const recentReports = yield* db.execute(
        db
          .selectFrom("post_reports")
          .select(["postId"])
          .where("createdAt", ">=", recentReportCutoff),
      );
      const recentReportedPostIds = new Set(
        recentReports.map((row) => row.postId),
      );

      const purgeableRevisions = allRevisions.filter(
        (revision) =>
          revision.createdAt.valueOf() <= cutoff.valueOf() &&
          !recentReportedPostIds.has(revision.postId),
      );

      const referencedKeys = new Set<string>();
      const liveVideos = yield* db.execute(
        db
          .selectFrom("posts")
          .select(["videoKey"])
          .where("videoKey", "is not", null),
      );
      for (const row of liveVideos) {
        if (row.videoKey !== null) {
          referencedKeys.add(row.videoKey);
        }
      }
      for (const revision of allRevisions) {
        referencedKeys.add(revision.videoKey);
      }

      const bucketKeys = yield* storage.listKeys("videos/");
      const mediaBucketKeys = bucketKeys.filter(
        (key) => !key.startsWith(PENDING_VIDEOS_PREFIX),
      );
      // Legacy keys are surfaced as quarantine candidates, but gcRun filters
      // them out because no registry owner/fence exists for safe deletion.
      const orphanKeys = mediaBucketKeys.filter(
        (key) => !referencedKeys.has(key),
      );

      return {
        orphanKeys,
        purgeableRevisions: purgeableRevisions.map((revision) => ({
          createdAt: toIsoTimestamp(revision.createdAt),
          id: revision.id,
          postId: revision.postId,
          replacedBy: revision.replacedBy,
          videoKey: revision.videoKey,
        })),
      } satisfies GcPreviewResult;
    });

    const requireAdmin = Effect.fn("VideosService.requireAdmin")(function* () {
      const { role } = yield* currentUserWithRank();
      if (!roleAtLeast(role, "admin")) {
        return yield* new ForbiddenError({
          message: ADMIN_ONLY_MESSAGE,
        });
      }
    });

    const replace = Effect.fn("VideosService.replace")(function* (input: {
      expectedVersion: number;
      operationKey: string;
      pendingVideoKey: string;
      postId: number;
    }) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireUser(
        "You must be logged in to replace a video",
      );
      const role = getUserRole(user);

      const requestFingerprint = yield* operationRequestFingerprint({
        fileDigests: [],
        operationKind: "video-replace",
        payload: {
          pendingVideoKey: input.pendingVideoKey,
          postId: input.postId,
        },
        userId: user.id,
        version: input.expectedVersion,
      });
      const claim = yield* lifecycle.claimOperation({
        kind: "video-replace",
        operationKey: input.operationKey,
        requestFingerprint,
        userId: user.id,
      });
      if (claim.outcome === "replayed") {
        if (claim.result?.videoKey === undefined) {
          return yield* new ValidationError({
            message: "Lifecycle replay did not contain a video result",
          });
        }
        return { videoKey: claim.result.videoKey };
      }
      const postOption = yield* loadPost(input.postId);
      if (Option.isNone(postOption)) {
        return yield* new PostNotFoundError({
          message: `Post ${input.postId} not found`,
          postId: input.postId,
        });
      }
      const post = postOption.value;
      if (post.videoKey === null) {
        return yield* new ValidationError({
          message:
            "This post has no video — image posts use the regular edit flow",
        });
      }
      const oldVideoKey = post.videoKey;

      // Author replaces their own video at any rank; non-authors need staff.
      if (
        post.userId !== user.id &&
        !userHasPermission(role, "videos:replace-any")
      ) {
        return yield* new ForbiddenError({
          message: STAFF_ONLY_MESSAGE,
        });
      }
      // Same trust model as first uploads: only promote objects staged in
      // the caller's own namespace (`videos/_pending/{userId}/…`).
      if (!input.pendingVideoKey.startsWith(pendingVideoPrefix(user.id))) {
        return yield* new ValidationError({
          message: "Invalid video upload key",
        });
      }

      const ext = input.pendingVideoKey.split(".").pop() ?? "";
      const expectedContentType = videoContentType(ext);
      const head = yield* storage.headFile(input.pendingVideoKey);
      if (!isUploadedVideoValid(head, expectedContentType)) {
        yield* storage.deleteFile(input.pendingVideoKey).pipe(Effect.ignore);
        return yield* new ValidationError({
          message: `Video upload is invalid: expected ${expectedContentType}, at most ${
            MAX_VIDEO_SIZE_BYTES / (1024 * 1024)
          } MB`,
        });
      }
      const sourceFingerprint =
        head.metadataFingerprint ??
        (head.etag === null ? "" : `etag:${head.etag}`);
      if (sourceFingerprint.length === 0 || head.etag === null) {
        return yield* new ValidationError({
          message: "Video upload could not be identified safely",
        });
      }
      const finalKey = videoObjectKey(claim.operationId, ext);
      const mediaObject = {
        contentLength: head.contentLength,
        contentType: head.contentType,
        fence: claim.fence,
        fingerprint: sourceFingerprint,
        key: finalKey,
        kind: "video" as const,
        operationId: claim.operationId,
        userId: user.id,
      };
      yield* lifecycle.reserveObject(mediaObject);
      yield* lifecycle.markPreparing(mediaObject);
      yield* storage.copyVideoIfMatch(
        input.pendingVideoKey,
        head.etag,
        finalKey,
      );
      // The source HEAD was validated and copyVideoIfMatch fenced the copy;
      // preserve the registered source identity rather than replacing a
      // metadata SHA-256 with an unrelated destination ETag.
      const observed = {
        contentLength: head.contentLength,
        contentType: head.contentType,
        fingerprint: sourceFingerprint,
      };

      // Revision, post CAS, media readiness and operation completion commit
      // together. The remote copy is intentionally outside this transaction.
      yield* db.transaction().execute((trx) =>
        Effect.gen(function* () {
          yield* markReadyInTransaction(
            trx,
            { ...mediaObject, observed },
            new Date(),
          );
          yield* trx.executeTakeFirstOrError(
            trx
              .insertInto("video_revisions")
              .values({
                postId: post.id,
                replacedBy: user.id,
                videoKey: oldVideoKey,
                videoMetadata: post.videoMetadata,
              })
              .returning("id"),
          );
          const updated = yield* trx.executeTakeFirstOption(
            trx
              .updateTable("posts")
              .set({ videoKey: finalKey, version: sql<number>`"version" + 1` })
              .where("id", "=", post.id)
              .where("version", "=", input.expectedVersion)
              .returning("id"),
          );
          if (Option.isNone(updated)) {
            return yield* new PostVersionConflictError({
              actualVersion: input.expectedVersion + 1,
              expectedVersion: input.expectedVersion,
              message: `Post ${post.id} changed while its video was being replaced`,
              postId: post.id,
            });
          }
          yield* finishOperationInTransaction(
            trx,
            {
              fence: claim.fence,
              operationId: claim.operationId,
              result: {
                postId: post.id,
                state: "completed",
                videoKey: finalKey,
              },
            },
            new Date(),
          );
        }),
      );
      yield* storage.deleteFile(input.pendingVideoKey).pipe(Effect.ignore);

      // Likes, comments and the post id stay untouched: this only swaps the
      // media backing the same content entry.
      yield* Effect.logInfo("Video replaced").pipe(
        Effect.annotateLogs({
          newPath: finalKey,
          oldPath: post.videoKey,
          postId: String(post.id),
          replacedBy: user.id,
        }),
      );
      return { videoKey: finalKey };
    });

    const listRevisions = Effect.fn("VideosService.listRevisions")(function* (
      postId: number,
    ) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireUser(
        "You must be logged in to view video history",
      );
      const role = getUserRole(user);

      const postOption = yield* loadPost(postId);
      if (Option.isNone(postOption)) {
        return yield* new PostNotFoundError({
          message: `Post ${postId} not found`,
          postId,
        });
      }
      if (
        postOption.value.userId !== user.id &&
        !userHasPermission(role, "videos:replace-any")
      ) {
        return yield* new ForbiddenError({
          message: STAFF_ONLY_MESSAGE,
        });
      }
      return yield* revisionsForPost(postId);
    });

    const restore = Effect.fn("VideosService.restore")(function* (input: {
      expectedVersion: number;
      operationKey: string;
      revisionId: number;
    }) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireUser(STAFF_ONLY_MESSAGE);
      const role = getUserRole(user);
      const requestFingerprint = yield* operationRequestFingerprint({
        fileDigests: [],
        operationKind: "video-restore",
        payload: { revisionId: input.revisionId },
        userId: user.id,
        version: input.expectedVersion,
      });
      const claim = yield* lifecycle.claimOperation({
        kind: "video-restore",
        operationKey: input.operationKey,
        requestFingerprint,
        userId: user.id,
      });
      if (claim.outcome === "replayed") return { restored: true as const };

      const revisionOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("video_revisions")
          .selectAll()
          .where("id", "=", input.revisionId),
      );
      if (Option.isNone(revisionOption)) {
        return yield* new ValidationError({
          message: `Revision ${input.revisionId} not found`,
        });
      }

      const postOption = yield* loadPost(revisionOption.value.postId);
      if (Option.isNone(postOption)) {
        return yield* new PostNotFoundError({
          message: `Post ${revisionOption.value.postId} not found`,
          postId: revisionOption.value.postId,
        });
      }

      // Restoring other users' videos mirrors the replace-any gate.
      if (!userHasPermission(role, "videos:replace-any")) {
        return yield* new ForbiddenError({
          message: STAFF_ONLY_MESSAGE,
        });
      }

      // Guard against a just-purged or legacy object being restored. A
      // revision is restorable only when its durable registry row is ready and
      // the key is in the managed deterministic namespace.
      const post = postOption.value;
      const revisionKey = revisionOption.value.videoKey;
      if (!isDeterministicMediaKey(revisionKey)) {
        return yield* new ValidationError({
          message:
            "This legacy video is quarantined and cannot be restored automatically",
        });
      }
      const registered = yield* db.executeTakeFirstOption(
        db
          .selectFrom("media_objects")
          .select(["state", "kind"])
          .where("key", "=", revisionKey),
      );
      if (
        Option.isNone(registered) ||
        registered.value.kind !== "video" ||
        registered.value.state !== "ready"
      ) {
        return yield* new ValidationError({
          message:
            "This video is not registered as ready and cannot be restored",
        });
      }
      yield* storage.headFile(revisionKey);
      yield* db.transaction().execute((trx) =>
        Effect.gen(function* () {
          if (post.videoKey !== null) {
            yield* trx.executeTakeFirstOrError(
              trx
                .insertInto("video_revisions")
                .values({
                  postId: post.id,
                  replacedBy: user.id,
                  videoKey: post.videoKey,
                  videoMetadata: post.videoMetadata,
                })
                .returning("id"),
            );
          }
          const updated = yield* trx.executeTakeFirstOption(
            trx
              .updateTable("posts")
              .set({
                videoKey: revisionOption.value.videoKey,
                version: sql<number>`"version" + 1`,
              })
              .where("id", "=", post.id)
              .where("version", "=", input.expectedVersion)
              .returning("id"),
          );
          if (Option.isNone(updated)) {
            return yield* new PostVersionConflictError({
              actualVersion: input.expectedVersion + 1,
              expectedVersion: input.expectedVersion,
              message: `Post ${post.id} changed while its video was being restored`,
              postId: post.id,
            });
          }
          yield* finishOperationInTransaction(
            trx,
            {
              fence: claim.fence,
              operationId: claim.operationId,
              result: {
                postId: post.id,
                state: "completed",
                videoKey: revisionKey,
              },
            },
            new Date(),
          );
        }),
      );

      yield* Effect.logInfo("Video restored from revision").pipe(
        Effect.annotateLogs({
          restoredBy: user.id,
          revisionId: String(input.revisionId),
        }),
      );
      return { restored: true as const };
    });

    const gcPreview = Effect.fn("VideosService.gcPreview")(function* () {
      yield* requireAdmin();
      return yield* analyzeGc();
    });

    const gcRun = Effect.fn("VideosService.gcRun")(function* () {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireUser(ADMIN_ONLY_MESSAGE);
      if (!roleAtLeast(getUserRole(user), "admin")) {
        return yield* new ForbiddenError({
          message: ADMIN_ONLY_MESSAGE,
        });
      }

      const { orphanKeys, purgeableRevisions } = yield* analyzeGc();

      const liveVideos = yield* db.execute(
        db
          .selectFrom("posts")
          .select("videoKey")
          .where("videoKey", "is not", null),
      );
      const allRevisions = yield* db.execute(
        db.selectFrom("video_revisions").select(["id", "videoKey"]),
      );
      const purgeableRevisionIds = new Set(
        purgeableRevisions.map((revision) => revision.id),
      );
      const protectedVideoKeys = new Set<string>(
        liveVideos.flatMap((row) =>
          row.videoKey === null ? [] : [row.videoKey],
        ),
      );
      for (const revision of allRevisions) {
        if (!purgeableRevisionIds.has(revision.id)) {
          protectedVideoKeys.add(revision.videoKey);
        }
      }

      // Unique deletion targets: a key may appear in both lists. Never delete
      // a key still referenced by a live post or a retained revision.
      const keysToDelete = new Set<string>(
        orphanKeys.filter(
          (key) => isDeterministicMediaKey(key) && !protectedVideoKeys.has(key),
        ),
      );
      for (const revision of purgeableRevisions) {
        if (
          isDeterministicMediaKey(revision.videoKey) &&
          !protectedVideoKeys.has(revision.videoKey)
        ) {
          keysToDelete.add(revision.videoKey);
        }
      }

      let deletedKeys = 0;
      const successfullyDeletedKeys = new Set<string>();
      const protectedAfterRecheck = new Set<string>();

      // Deterministic objects have a durable owner/fence in media_objects. The
      // lifecycle transition is the delete lease: it rechecks every reference
      // while locking the registry row, so a concurrent restore or replacement
      // cannot turn an orphan decision into data loss. Legacy `videos/` keys
      // deliberately remain quarantine-only because they have no fence.
      const managedObjects =
        keysToDelete.size === 0
          ? []
          : yield* db.execute(
              db
                .selectFrom("media_objects")
                .select(["fence", "key", "operationId", "state"])
                .where("key", "in", [...keysToDelete]),
            );
      const managedByKey = new Map(
        managedObjects.map((object) => [object.key, object]),
      );
      for (const key of keysToDelete) {
        const managed = managedByKey.get(key);
        if (managed === undefined || managed.state !== "ready") continue;

        // beginDelete performs the authoritative reference recheck under the
        // lifecycle row lock. A revision reference is therefore retained for
        // this pass and purged only after the object is protected; the next GC
        // pass can then acquire the delete lease safely.
        const begun = yield* lifecycle
          .beginDelete({
            fence: managed.fence,
            key: managed.key,
            operationId: managed.operationId,
          })
          .pipe(Effect.exit);
        if (Exit.isFailure(begun)) continue;

        if (begun.value.outcome === "protected") {
          protectedAfterRecheck.add(key);
          continue;
        }
        // A failed or uncertain delete intentionally leaves the row in
        // `deleting`; no revision row is purged and a later reconciler can
        // safely retry it. Only completeDelete creates the permanent tombstone.
        const removed = yield* storage.deleteFile(key).pipe(Effect.exit);
        if (Exit.isFailure(removed)) continue;
        const completed = yield* lifecycle
          .completeDelete({
            fence: begun.value.fence,
            key: begun.value.key,
            operationId: managed.operationId,
          })
          .pipe(Effect.exit);
        if (Exit.isFailure(completed)) continue;

        deletedKeys += 1;
        successfullyDeletedKeys.add(key);
      }

      // Rows go last: purge only revisions whose object was actually confirmed
      // deleted, or whose key was protected by the reference recheck. A key
      // that was already deleting is not safe to purge until its delete is
      // durably completed.
      let purgedRevisions = 0;
      for (const revision of purgeableRevisions) {
        if (
          !protectedVideoKeys.has(revision.videoKey) &&
          !protectedAfterRecheck.has(revision.videoKey) &&
          !successfullyDeletedKeys.has(revision.videoKey)
        ) {
          continue;
        }
        yield* db.execute(
          db.deleteFrom("video_revisions").where("id", "=", revision.id),
        );
        purgedRevisions += 1;
      }

      yield* Effect.logInfo("Storage GC completed").pipe(
        Effect.annotateLogs({
          deletedKeys: String(deletedKeys),
          purgedRevisions: String(purgedRevisions),
          triggeredBy: user.id,
        }),
      );
      return { deletedKeys, purgedRevisions };
    });

    return { gcPreview, gcRun, listRevisions, replace, restore };
  }),
}) {
  static readonly replace = Effect.fn("VideosService.replace")(
    function* (input: {
      expectedVersion: number;
      operationKey: string;
      pendingVideoKey: string;
      postId: number;
    }) {
      const svc = yield* VideosService;
      return yield* svc.replace(input);
    },
  );

  static readonly listRevisions = Effect.fn("VideosService.listRevisions")(
    function* (postId: number) {
      const svc = yield* VideosService;
      return yield* svc.listRevisions(postId);
    },
  );

  static readonly restore = Effect.fn("VideosService.restore")(
    function* (input: {
      expectedVersion: number;
      operationKey: string;
      revisionId: number;
    }) {
      const svc = yield* VideosService;
      return yield* svc.restore(input);
    },
  );

  static readonly gcPreview = Effect.fn("VideosService.gcPreview")(
    function* () {
      const svc = yield* VideosService;
      return yield* svc.gcPreview();
    },
  );

  static readonly gcRun = Effect.fn("VideosService.gcRun")(function* () {
    const svc = yield* VideosService;
    return yield* svc.gcRun();
  });
}

export const VideosServiceLive = Layer.effect(
  VideosService,
  VideosService.make,
).pipe(Layer.provideMerge(LifecycleServiceLive));

export const previewGc = createServerFn().handler(
  createHandler(
    VideosServiceLive,
    baseLayerFactories.auth,
  )(VideosService.gcPreview),
);

export const runGc = createServerFn({ method: "POST" }).handler(
  createHandler(
    VideosServiceLive,
    baseLayerFactories.auth,
  )(VideosService.gcRun),
);
