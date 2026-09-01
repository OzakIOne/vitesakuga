import { createServerFn } from "@tanstack/react-start";
import { Context, DateTime, Effect, Layer, Option } from "effect";

import { getUserRole, userHasPermission } from "../auth/policy";
import { isStaffRole } from "../auth/roles";
import { SessionFetchError, SessionService } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { SqlError, SqlNoFirstResult } from "../effect/effect.utils";
import { parseStrict } from "../effect/schema.utils";
import {
  EditAlreadyResolvedError,
  EditNotFoundError,
  ForbiddenError,
  PostNotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../errors";
import { asPostId, type PostId } from "../ids";
import {
  NotificationsService,
  NotificationsServiceLive,
} from "../notifications/notifications.service";
import { PointsServiceLive } from "../points/points.service";
import { PointsService } from "../points/points.service";
import { baseLayerFactories, createHandler } from "../server-fn.handler";
import {
  decodePostEditPayload,
  editIdSchema,
  fetchPostEditsSchema,
  proposeEditSchema,
  type PostEditPayload,
} from "./post-edits.schema";

const REQUIRED_VOTES = 2;

/** Field iteration order for applying suggestion patches. */
const PAYLOAD_KEYS: ReadonlyArray<keyof PostEditPayload> = [
  "animeTitle",
  "chapterNumber",
  "description",
  "episodeNumber",
  "seasonNumber",
  "source",
  "title",
  "volumeNumber",
];

export type PendingEdit = {
  readonly approvals: ReadonlyArray<string>;
  /** ISO timestamp string — `Date` does not survive the JSON server-function transport. */
  readonly createdAt: string;
  readonly id: number;
  readonly payload: PostEditPayload;
  readonly postId: number;
  readonly suggestedBy: string;
};

export class PostEditsService extends Context.Service<
  PostEditsService,
  {
    // Every method resolves SessionService per call (repo-wide contract
    // style), so the requirement channel carries it explicitly.

    /** Proposes field changes on someone else's post (uploader-only). */
    readonly propose: (input: {
      payload: PostEditPayload;
      postId: number;
    }) => Effect.Effect<
      { editId: number },
      | ForbiddenError
      | PostNotFoundError
      | SessionFetchError
      | SqlError
      | SqlNoFirstResult
      | UnauthorizedError
      | ValidationError,
      SessionService
    >;

    /**
     * Votes on a pending suggestion. Staff and the post owner apply it
     * immediately; otherwise a second uploader approval applies it.
     */
    readonly approve: (
      editId: number,
    ) => Effect.Effect<
      { applied: boolean },
      | EditAlreadyResolvedError
      | EditNotFoundError
      | ForbiddenError
      | PostNotFoundError
      | SessionFetchError
      | SqlError
      | UnauthorizedError,
      SessionService
    >;

    /** Rejects a pending suggestion (staff or post owner only). */
    readonly reject: (
      editId: number,
    ) => Effect.Effect<
      { rejected: boolean },
      | EditAlreadyResolvedError
      | EditNotFoundError
      | ForbiddenError
      | PostNotFoundError
      | SessionFetchError
      | SqlError
      | UnauthorizedError,
      SessionService
    >;

    /** Pending suggestions for one post, with their current approvals. */
    readonly listPendingForPost: (
      postId: PostId,
    ) => Effect.Effect<
      ReadonlyArray<PendingEdit>,
      SessionFetchError | SqlError | UnauthorizedError,
      SessionService
    >;
  }
>()("PostEditsService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;
    const points = yield* PointsService;
    const notifications = yield* NotificationsService;

    // Resolved per call so the requirement surfaces in each method's type
    // (repo-wide contract style; see CommentsService).
    const requireSignedIn = () =>
      Effect.flatMap(SessionService, (sessions) =>
        sessions.requireUser(
          "You must be logged in to review edit suggestions",
        ),
      );

    const loadPostOwner = (postId: number) =>
      db.executeTakeFirstOption(
        db
          .selectFrom("posts")
          .select(["id", "userId"])
          .where("id", "=", postId),
      );

    const loadEdit = (editId: number) =>
      db.executeTakeFirstOption(
        db
          .selectFrom("post_edits")
          .select([
            "createdAt",
            "id",
            "payload",
            "postId",
            "status",
            "suggestedBy",
          ])
          .where("id", "=", editId),
      );

    const approvalsFor = (editId: number) =>
      db.execute(
        db
          .selectFrom("post_edit_approvals")
          .select("userId")
          .where("editId", "=", editId)
          .orderBy("createdAt", "asc"),
      );

    /**
     * Shared decision guard: resolves the edit + post, checks the edit is
     * still pending and that the current user may decide at all.
     * Suggesters never may — resolving your own suggestion would bypass
     * peer review entirely.
     */
    const resolveDecisionContext = (editId: number) =>
      Effect.gen(function* () {
        const user = yield* requireSignedIn();
        const role = getUserRole(user);

        const editOption = yield* loadEdit(editId);
        if (Option.isNone(editOption)) {
          return yield* new EditNotFoundError({
            editId,
            message: `Edit suggestion ${editId} not found`,
          });
        }
        const edit = editOption.value;
        if (edit.status !== "pending") {
          return yield* new EditAlreadyResolvedError({
            editId,
            message: `Edit suggestion ${editId} was already ${edit.status}`,
          });
        }

        const postOption = yield* loadPostOwner(edit.postId);
        if (Option.isNone(postOption)) {
          return yield* new PostNotFoundError({
            message: `Post ${edit.postId} not found`,
            postId: edit.postId,
          });
        }

        if (edit.suggestedBy === user.id) {
          return yield* new ForbiddenError({
            message:
              "You cannot approve or reject your own edit suggestion — wait for peer review.",
          });
        }

        const isOwner = postOption.value.userId === user.id;
        const isStaff = isStaffRole(role);
        const canVote =
          isStaff || isOwner || userHasPermission(role, "posts:suggest-edit");
        if (!canVote) {
          return yield* new ForbiddenError({
            message:
              "Only uploaders, staff or the post owner can review suggestions.",
          });
        }

        return {
          edit,
          isInstantDecider: isStaff || isOwner,
          isStaffOrOwner: isStaff || isOwner,
          postOwnerId: postOption.value.userId,
          userId: user.id,
        };
      });

    const propose = Effect.fn("PostEditsService.propose")(function* (input: {
      payload: PostEditPayload;
      postId: number;
    }) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireUser(
        "You must be logged in to suggest an edit",
      );

      const postOption = yield* loadPostOwner(input.postId);
      if (Option.isNone(postOption)) {
        return yield* new PostNotFoundError({
          message: `Post ${input.postId} not found`,
          postId: input.postId,
        });
      }
      // Owners already hold direct-edit rights at any rank; routing them
      // through review would just add latency to their own edits. Checked
      // before the rank gate so a novice owner gets the direct-edit hint.
      if (postOption.value.userId === user.id) {
        return yield* new ValidationError({
          message: "This is your post — edit it directly instead",
        });
      }

      if (!userHasPermission(getUserRole(user), "posts:suggest-edit")) {
        return yield* new ForbiddenError({
          message: "You need the uploader rank to suggest edits.",
        });
      }

      const created = yield* db.executeTakeFirstOrError(
        db
          .insertInto("post_edits")
          .values({
            payload: input.payload,
            postId: input.postId,
            status: "pending",
            suggestedBy: user.id,
          })
          .returning("id"),
      );

      yield* Effect.logInfo("Edit suggestion proposed").pipe(
        Effect.annotateLogs({
          editId: String(created.id),
          postId: String(input.postId),
          userId: user.id,
        }),
      );
      return { editId: created.id };
    });

    const approve = Effect.fn("PostEditsService.approve")(function* (
      editId: number,
    ) {
      const context = yield* resolveDecisionContext(editId);

      let stillNeeded = 0;
      if (!context.isInstantDecider) {
        const existing = yield* approvalsFor(editId);
        const otherVotes = existing.filter(
          (row) =>
            row.userId !== context.userId &&
            row.userId !== context.edit.suggestedBy,
        ).length;
        stillNeeded = Math.max(0, REQUIRED_VOTES - 1 - otherVotes);
      }

      // Record this vote; repeat clicks are no-ops via the composite PK.
      yield* db.execute(
        db
          .insertInto("post_edit_approvals")
          .values({ editId, userId: context.userId })
          .onConflict((oc) => oc.columns(["editId", "userId"]).doNothing()),
      );

      if (stillNeeded > 0) {
        yield* Effect.logInfo("Edit suggestion vote recorded").pipe(
          Effect.annotateLogs({
            approvedBy: context.userId,
            editId: String(editId),
            votesStillNeeded: String(stillNeeded),
          }),
        );
        return { applied: false as const };
      }

      // Apply the patch built strictly from the defined payload fields.
      const decoded = decodePostEditPayload(context.edit.payload);
      const patch: {
        -readonly [K in keyof PostEditPayload]+?: PostEditPayload[K];
      } = {};
      // The generic keeps key and value correlated, so each write is checked
      // against its own field type instead of the whole value union.
      const copyIfDefined = <K extends keyof PostEditPayload>(
        key: K,
        source: PostEditPayload,
        target: {
          -readonly [L in keyof PostEditPayload]+?: PostEditPayload[L];
        },
      ): void => {
        const value = source[key];
        if (value !== undefined) {
          target[key] = value;
        }
      };
      for (const key of PAYLOAD_KEYS) {
        copyIfDefined(key, decoded, patch);
      }
      const now = yield* DateTime.now;
      const resolvedAt = DateTime.toDate(now);
      yield* db.execute(
        db
          .updateTable("posts")
          .set(patch)
          .where("id", "=", context.edit.postId),
      );
      yield* db.execute(
        db
          .updateTable("post_edits")
          .set({ resolvedAt, resolvedBy: context.userId, status: "approved" })
          .where("id", "=", editId)
          .where("status", "=", "pending"),
      );

      // The suggester earns their reward exactly once per applied edit
      // (ledger dedupe on suggester × action × editId), daily-capped to
      // blunt collusion rings.
      yield* points.awardOrLog({
        userId: context.edit.suggestedBy,
        action: "edit-suggestion-approved",
        refId: editId,
      });
      yield* notifications.notifyOrLog({
        type: "edit-suggestion-applied",
        userId: context.postOwnerId,
      });

      yield* Effect.logInfo("Edit suggestion applied").pipe(
        Effect.annotateLogs({
          approvedBy: context.userId,
          editId: String(editId),
          postId: String(context.edit.postId),
        }),
      );
      return { applied: true as const };
    });

    const reject = Effect.fn("PostEditsService.reject")(function* (
      editId: number,
    ) {
      const context = yield* resolveDecisionContext(editId);
      if (!context.isStaffOrOwner) {
        return yield* new ForbiddenError({
          message: "Only staff or the post owner can reject a suggestion.",
        });
      }
      const now = yield* DateTime.now;
      yield* db.execute(
        db
          .updateTable("post_edits")
          .set({
            resolvedAt: DateTime.toDate(now),
            resolvedBy: context.userId,
            status: "rejected",
          })
          .where("id", "=", editId)
          .where("status", "=", "pending"),
      );
      return { rejected: true as const };
    });

    const listPendingForPost = Effect.fn("PostEditsService.listPendingForPost")(
      function* (postId: PostId) {
        yield* requireSignedIn();
        const rows = yield* db.execute(
          db
            .selectFrom("post_edits")
            .select(["createdAt", "id", "payload", "postId", "suggestedBy"])
            .where("postId", "=", postId)
            .where("status", "=", "pending")
            .orderBy("createdAt", "desc"),
        );
        return yield* Effect.forEach(rows, (row) =>
          Effect.gen(function* () {
            const approvals = yield* approvalsFor(row.id);
            return {
              approvals: approvals.map((approval) => approval.userId),
              createdAt: row.createdAt.toISOString(),
              id: row.id,
              payload: decodePostEditPayload(row.payload),
              postId: row.postId,
              suggestedBy: row.suggestedBy,
            } as const satisfies PendingEdit;
          }),
        );
      },
    );

    return { approve, listPendingForPost, propose, reject };
  }),
}) {
  static readonly propose = Effect.fn("PostEditsService.propose")(
    function* (input: { payload: PostEditPayload; postId: number }) {
      const svc = yield* PostEditsService;
      return yield* svc.propose(input);
    },
  );

  static readonly approve = Effect.fn("PostEditsService.approve")(function* (
    editId: number,
  ) {
    const svc = yield* PostEditsService;
    return yield* svc.approve(editId);
  });

  static readonly reject = Effect.fn("PostEditsService.reject")(function* (
    editId: number,
  ) {
    const svc = yield* PostEditsService;
    return yield* svc.reject(editId);
  });

  static readonly listPendingForPost = Effect.fn(
    "PostEditsService.listPendingForPost",
  )(function* (postId: PostId) {
    const svc = yield* PostEditsService;
    return yield* svc.listPendingForPost(postId);
  });
}

export const PostEditsServiceLive = Layer.effect(
  PostEditsService,
  PostEditsService.make,
).pipe(
  Layer.provideMerge(PointsServiceLive),
  Layer.provideMerge(NotificationsServiceLive),
);

export const proposeEdit = createServerFn({ method: "POST" })
  .validator(parseStrict(proposeEditSchema))
  .handler(
    createHandler(
      PostEditsServiceLive,
      baseLayerFactories.auth,
    )((input) => PostEditsService.propose(input)),
  );

export const approveEdit = createServerFn({ method: "POST" })
  .validator(parseStrict(editIdSchema))
  .handler(
    createHandler(
      PostEditsServiceLive,
      baseLayerFactories.auth,
    )((input: { editId: number }) => PostEditsService.approve(input.editId)),
  );

export const rejectEdit = createServerFn({ method: "POST" })
  .validator(parseStrict(editIdSchema))
  .handler(
    createHandler(
      PostEditsServiceLive,
      baseLayerFactories.auth,
    )((input: { editId: number }) => PostEditsService.reject(input.editId)),
  );

export const fetchPostEdits = createServerFn({ strict: { output: false } })
  .validator(parseStrict(fetchPostEditsSchema))
  .handler(
    createHandler(
      PostEditsServiceLive,
      baseLayerFactories.auth,
    )((input: { postId: number }) =>
      PostEditsService.listPendingForPost(asPostId(input.postId)),
    ),
  );
