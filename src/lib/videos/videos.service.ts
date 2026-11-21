import { createServerFn } from "@tanstack/react-start";
import { Clock, Context, Effect, Layer, Option } from "effect";

import { authorize, requireRecentSignIn } from "../auth/policy";
import { SessionService } from "../auth/session.effect";
import { SessionFetchError } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { SqlError, SqlNoFirstResult } from "../db/effect-kysely";
import { toIsoTimestamp } from "../db/schema/timestamp";
import { parse } from "../effect/schema.utils";
import {
  AccountSuspendedError,
  ForbiddenError,
  PostNotFoundError,
  ReauthenticationRequiredError,
  UnauthorizedError,
  ValidationError,
} from "../errors";
import type { FingerprintInputError } from "../lifecycle/fingerprint";
import {
  LifecycleService,
  LifecycleServiceLive,
  type LifecycleError,
} from "../lifecycle/lifecycle.service";
import { VideoMetadataSchema } from "../posts/posts.schema";
import { createEndpointHandler } from "../server-endpoint";
import { baseLayerFactories } from "../server-fn.handler";
import {
  isDeterministicMediaKey,
  PENDING_VIDEOS_PREFIX,
} from "../storage/keys";
import { StorageError, StorageModule } from "../storage/storage.module";
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
  | AccountSuspendedError
  | ForbiddenError
  | PostNotFoundError
  | ReauthenticationRequiredError
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

    const loadPost = (postId: number) =>
      db
        .executeTakeFirstOption(
          db
            .selectFrom("posts")
            .select(["id", "userId", "videoKey", "videoMetadata", "version"])
            .where("id", "=", postId),
        )
        .pipe(
          Effect.map((post) =>
            Option.map(post, (row) => ({
              ...row,
              videoMetadata: parse(VideoMetadataSchema)(row.videoMetadata),
            })),
          ),
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
        db
          .selectFrom("video_revisions")
          .select(["createdAt", "id", "postId", "replacedBy", "videoKey"]),
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

    const requireStorageMaintainer = Effect.fn(
      "VideosService.requireStorageMaintainer",
    )(function* () {
      const sessions = yield* SessionService;
      const actor = yield* sessions.requireReadActor("You must be logged in.");
      yield* authorize({
        actor,
        permission: "storage:maintain",
        forbiddenMessage: ADMIN_ONLY_MESSAGE,
      });
    });

    const replace = Effect.fn("VideosService.replace")(function* (input: {
      expectedVersion: number;
      operationKey: string;
      pendingVideoKey: string;
      postId: number;
    }) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireActor(
        "You must be logged in to replace a video",
      );

      return yield* lifecycle.runOperation({
        kind: "video-replace",
        operationKey: input.operationKey,
        replay: (result) => Effect.succeed({ videoKey: result.videoKey }),
        request: {
          payload: {
            pendingVideoKey: input.pendingVideoKey,
            postId: input.postId,
          },
          version: input.expectedVersion,
        },
        userId: user.id,
        run: (operation) =>
          Effect.gen(function* () {
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
            if (post.userId !== user.id) {
              yield* authorize({
                actor: user,
                permission: "videos:replace-any",
                forbiddenMessage: STAFF_ONLY_MESSAGE,
              });
            }
            const { videoKey } = yield* lifecycle.replaceVideo({
              expectedVersion: input.expectedVersion,
              oldVideoKey,
              operation,
              pendingVideoKey: input.pendingVideoKey,
              postId: post.id,
              replacedBy: user.id,
              userId: user.id,
              videoMetadata: post.videoMetadata,
            });

            // Likes, comments and the post id stay untouched: this only swaps the
            // media backing the same content entry.
            yield* Effect.logInfo("Video replaced").pipe(
              Effect.annotateLogs({
                newPath: videoKey,
                oldPath: post.videoKey,
                postId: String(post.id),
                replacedBy: user.id,
              }),
            );
            return { videoKey };
          }),
      });
    });

    const listRevisions = Effect.fn("VideosService.listRevisions")(function* (
      postId: number,
    ) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireReadActor(
        "You must be logged in to view video history",
      );

      const postOption = yield* loadPost(postId);
      if (Option.isNone(postOption)) {
        return yield* new PostNotFoundError({
          message: `Post ${postId} not found`,
          postId,
        });
      }
      if (postOption.value.userId !== user.id) {
        yield* authorize({
          actor: user,
          permission: "videos:replace-any",
          forbiddenMessage: STAFF_ONLY_MESSAGE,
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
      const user = yield* sessions.requireActor(STAFF_ONLY_MESSAGE);
      return yield* lifecycle.runOperation({
        kind: "video-restore",
        operationKey: input.operationKey,
        replay: () => Effect.succeed({ restored: true as const }),
        request: {
          payload: { revisionId: input.revisionId },
          version: input.expectedVersion,
        },
        userId: user.id,
        run: (operation) =>
          Effect.gen(function* () {
            const revisionOption = yield* db.executeTakeFirstOption(
              db
                .selectFrom("video_revisions")
                .select(["postId", "videoKey"])
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
            yield* authorize({
              actor: user,
              permission: "videos:replace-any",
              forbiddenMessage: STAFF_ONLY_MESSAGE,
            });

            // Guard against a just-purged or legacy object being restored. A
            // revision is restorable only when its durable registry row is ready and
            // the key is in the managed deterministic namespace.
            const post = postOption.value;
            const revisionKey = revisionOption.value.videoKey;
            yield* lifecycle.restoreVideo({
              expectedVersion: input.expectedVersion,
              operation,
              postId: post.id,
              previousVideo:
                post.videoKey === null
                  ? null
                  : {
                      videoKey: post.videoKey,
                      videoMetadata: post.videoMetadata,
                    },
              replacedBy: user.id,
              revisionKey,
            });

            yield* Effect.logInfo("Video restored from revision").pipe(
              Effect.annotateLogs({
                restoredBy: user.id,
                revisionId: String(input.revisionId),
              }),
            );
            return { restored: true as const };
          }),
      });
    });

    const gcPreview = Effect.fn("VideosService.gcPreview")(function* () {
      yield* requireStorageMaintainer();
      return yield* analyzeGc();
    });

    const gcRun = Effect.fn("VideosService.gcRun")(function* () {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireActor(ADMIN_ONLY_MESSAGE);
      yield* authorize({
        actor: user,
        permission: "storage:maintain",
        forbiddenMessage: ADMIN_ONLY_MESSAGE,
      });
      yield* requireRecentSignIn({ actor: user });

      // Reconcile any stalled non-terminal operations/objects before scanning
      // for orphans so uncertain deletes finish and ready objects are settled.
      yield* lifecycle.reconcileNonTerminal().pipe(Effect.ignore);

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

      // Deterministic objects have a durable owner/fence in media_objects.
      // Legacy `videos/` keys deliberately remain quarantine-only.
      const {
        deletedKeys: successfullyDeletedKeys,
        protectedKeys: protectedAfterRecheck,
      } = yield* lifecycle.deleteManagedKeys([...keysToDelete]);
      const deletedKeys = successfullyDeletedKeys.size;

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
}) {}

export const VideosServiceLive = Layer.effect(
  VideosService,
  VideosService.make,
).pipe(Layer.provideMerge(LifecycleServiceLive));

export const previewGc = createServerFn().handler(
  createEndpointHandler({
    service: VideosService,
    operation: "gcPreview",
    layer: VideosServiceLive,
    base: baseLayerFactories.auth,
  }),
);

export const runGc = createServerFn({ method: "POST" }).handler(
  createEndpointHandler({
    service: VideosService,
    operation: "gcRun",
    layer: VideosServiceLive,
    base: baseLayerFactories.auth,
  }),
);
