import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Exit, Layer, Option, Schema } from "effect";

import { getUserRole, userHasPermission } from "../auth/policy";
import { roleAtLeast } from "../auth/roles";
import { SessionService } from "../auth/session.effect";
import { SessionFetchError } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { toIsoTimestamp } from "../db/schema/timestamp";
import { SqlError, SqlNoFirstResult } from "../effect/effect.utils";
import { parseStrict } from "../effect/schema.utils";
import {
  ForbiddenError,
  PostNotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../errors";
import { MAX_VIDEO_SIZE_BYTES } from "../posts/posts.schema";
import { baseLayerFactories, createHandler } from "../server-fn.handler";
import { videoContentType } from "../storage/content-type";
import { pendingVideoPrefix } from "../storage/keys";
import { StorageError, StorageModule } from "../storage/storage.module";
import { isUploadedVideoValid } from "../storage/upload-policy";
import {
  DAY_MS,
  REVISION_RETENTION_DAYS,
  replaceVideoSchema,
} from "./videos.config";

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
  | ForbiddenError
  | PostNotFoundError
  | SessionFetchError
  | SqlError
  | SqlNoFirstResult
  | StorageError
  | UnauthorizedError
  | ValidationError;

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
    readonly restore: (
      revisionId: number,
    ) => Effect.Effect<{ restored: true }, ServiceFailure, SessionService>;

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

    const archiveRevision = (args: {
      readonly postId: number;
      readonly replacedBy: string;
      readonly videoKey: string;
      readonly videoMetadata: unknown;
    }) =>
      db.executeTakeFirstOrError(
        db
          .insertInto("video_revisions")
          .values({
            postId: args.postId,
            replacedBy: args.replacedBy,
            videoKey: args.videoKey,
            videoMetadata: args.videoMetadata,
          })
          .returning("id"),
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
      const now = new Date();
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
        (key) => !key.startsWith(pendingVideoPrefix("")),
      );
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
      pendingVideoKey: string;
      postId: number;
    }) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireUser(
        "You must be logged in to replace a video",
      );
      const role = getUserRole(user);

      const postOption = yield* loadPost(input.postId);
      if (Option.isNone(postOption)) {
        return yield* new PostNotFoundError({
          message: `Post ${input.postId} not found`,
          postId: input.postId,
        });
      }
      const post = postOption.value;

      // Author replaces their own video at any rank; non-authors need staff.
      if (
        post.userId !== user.id &&
        !userHasPermission(role, "videos:replace-any")
      ) {
        return yield* new ForbiddenError({
          message: STAFF_ONLY_MESSAGE,
        });
      }
      if (post.videoKey === null) {
        return yield* new ValidationError({
          message:
            "This post has no video — image posts use the regular edit flow",
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

      const finalized = yield* storage.finalizeVideoUpload(
        input.pendingVideoKey,
      );

      // Archive before overwriting so a failure between these steps leaves
      // the old object intact and still referenced.
      yield* archiveRevision({
        postId: post.id,
        replacedBy: user.id,
        videoKey: post.videoKey,
        // posts stores a JSON string; the revision column accepts any JSON value.
        videoMetadata: post.videoMetadata,
      });

      yield* db.execute(
        db
          .updateTable("posts")
          .set({ videoKey: finalized.key })
          .where("id", "=", post.id),
      );

      // Likes, comments and the post id stay untouched: this only swaps the
      // media backing the same content entry.
      yield* Effect.logInfo("Video replaced").pipe(
        Effect.annotateLogs({
          newPath: finalized.key,
          oldPath: post.videoKey,
          postId: String(post.id),
          replacedBy: user.id,
        }),
      );
      return { videoKey: finalized.key };
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

    const restore = Effect.fn("VideosService.restore")(function* (
      revisionId: number,
    ) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireUser(STAFF_ONLY_MESSAGE);
      const role = getUserRole(user);

      const revisionOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("video_revisions")
          .selectAll()
          .where("id", "=", revisionId),
      );
      if (Option.isNone(revisionOption)) {
        return yield* new ValidationError({
          message: `Revision ${revisionId} not found`,
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

      // Guard against a just-purged object being restored onto the post.
      const post = postOption.value;
      if (post.videoKey !== null) {
        // Keep the currently-live video undoable too.
        yield* archiveRevision({
          postId: post.id,
          replacedBy: user.id,
          videoKey: post.videoKey,
          videoMetadata: post.videoMetadata,
        });
      }

      yield* db.execute(
        db
          .updateTable("posts")
          .set({
            videoKey: revisionOption.value.videoKey,
          })
          .where("id", "=", post.id),
      );

      yield* Effect.logInfo("Video restored from revision").pipe(
        Effect.annotateLogs({
          restoredBy: user.id,
          revisionId: String(revisionId),
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

      // Unique deletion targets: a key may appear in both lists.
      const keysToDelete = new Set<string>(orphanKeys);
      for (const revision of purgeableRevisions) {
        keysToDelete.add(revision.videoKey);
      }

      let deletedKeys = 0;
      for (const key of keysToDelete) {
        const result = yield* storage.deleteFile(key).pipe(Effect.exit);
        if (Exit.isFailure(result)) continue;
        deletedKeys += 1;
      }

      // Rows go last: only revisions whose object was actually confirmed
      // deleted — otherwise the bookkeeping needed for a later sweep would
      // be lost while the file is still in the bucket.
      let purgedRevisions = 0;
      for (const revision of purgeableRevisions) {
        if (!keysToDelete.has(revision.videoKey)) {
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
    function* (input: { pendingVideoKey: string; postId: number }) {
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

  static readonly restore = Effect.fn("VideosService.restore")(function* (
    revisionId: number,
  ) {
    const svc = yield* VideosService;
    return yield* svc.restore(revisionId);
  });

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
);

export const replaceVideo = createServerFn({ method: "POST" })
  .validator(parseStrict(replaceVideoSchema))
  .handler(
    createHandler(
      VideosServiceLive,
      baseLayerFactories.auth,
    )((input) => VideosService.replace(input)),
  );

export const fetchVideoRevisions = createServerFn({ strict: { output: false } })
  .validator(parseStrict(Schema.Struct({ postId: Schema.Number })))
  .handler(
    createHandler(
      VideosServiceLive,
      baseLayerFactories.auth,
    )((input: { postId: number }) => VideosService.listRevisions(input.postId)),
  );

export const restoreVideoRevision = createServerFn({ method: "POST" })
  .validator(parseStrict(Schema.Struct({ revisionId: Schema.Number })))
  .handler(
    createHandler(
      VideosServiceLive,
      baseLayerFactories.auth,
    )((input: { revisionId: number }) =>
      VideosService.restore(input.revisionId),
    ),
  );

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
