import { createServerFn } from "@tanstack/react-start";
import { Context, DateTime, Effect, Layer, Option, Schema } from "effect";

import {
  ensureAdminRemains,
  lockActiveAdminIds,
} from "../auth/admin-continuity";
import {
  authorize,
  requireRecentSignIn,
  roleHasPermission,
} from "../auth/policy";
import { RoleSchema, type Role } from "../auth/roles";
import {
  SessionFetchError,
  SessionService,
  type AuthorizedActor,
} from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import type { EffectTransaction } from "../db/effect-kysely";
import { SqlError } from "../db/effect-kysely";
import type { DB } from "../db/kysely";
import { toIsoTimestamp } from "../db/schema/timestamp";
import { parseStrict } from "../effect/schema.utils";
import {
  AccountSuspendedError,
  ForbiddenError,
  LastAdminError,
  ReauthenticationRequiredError,
  UnauthorizedError,
  UserNotFoundError,
  ValidationError,
} from "../errors";
import { createEndpointHandler } from "../server-endpoint";
import { baseLayerFactories } from "../server-fn.handler";

const MOD_QUEUE_LIMIT = 50;

/** A recent post report, joined with its post title and reporter name. */
type ModerationReportRow = {
  /** ISO timestamp string — `Date` instances do not survive the JSON server-function transport. */
  readonly createdAt: string;
  readonly postId: number;
  readonly postTitle: string;
  readonly reason: string;
  readonly reporterName: string;
};

/** A pending edit suggestion with its live approval count. */
export type ModerationPendingEditRow = {
  readonly approvals: number;
  /** ISO timestamp string — `Date` instances do not survive the JSON server-function transport. */
  readonly createdAt: string;
  readonly editId: number;
  readonly postId: number;
  readonly postTitle: string;
  readonly suggestedByName: string;
};

export type ModerationOverview = {
  readonly pendingEdits: ReadonlyArray<ModerationPendingEditRow>;
  readonly reports: ReadonlyArray<ModerationReportRow>;
};

type ModerationFailure =
  | AccountSuspendedError
  | ForbiddenError
  | LastAdminError
  | ReauthenticationRequiredError
  | SessionFetchError
  | SqlError
  | UnauthorizedError
  | UserNotFoundError
  | ValidationError;

export class ModerationService extends Context.Service<
  ModerationService,
  {
    /**
     * Staff-only queue overview: recent reports plus every pending edit
     * suggestion across posts. Promotion candidates have their own endpoint
     * (`fetchPromotionQueue`).
     */
    readonly overview: () => Effect.Effect<
      ModerationOverview,
      ModerationFailure,
      SessionService
    >;

    /** Admin-only direct rank assignment (demotions included). */
    readonly setUserRole: (input: {
      role: string;
      userId: string;
    }) => Effect.Effect<{ userId: string }, ModerationFailure, SessionService>;

    /** Moderator or admin suspension with a reason; idempotent on an already-suspended account. */
    readonly suspendUser: (input: {
      reason: string;
      userId: string;
    }) => Effect.Effect<{ userId: string }, ModerationFailure, SessionService>;

    /** Lifts a suspension; idempotent on an account that is not suspended. */
    readonly unsuspendUser: (input: {
      userId: string;
    }) => Effect.Effect<{ userId: string }, ModerationFailure, SessionService>;
  }
>()("ModerationService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;

    /** Shared staff gate: a signed-in actor who may view the moderation queues. */
    const requireStaff = Effect.fn("ModerationService.requireStaff")(function* (
      message: string,
    ) {
      const sessions = yield* SessionService;
      const actor = yield* sessions.requireReadActor(message);
      yield* authorize({
        actor,
        permission: "moderation:view",
        forbiddenMessage: message,
      });
      return actor;
    });

    const overview = Effect.fn("ModerationService.overview")(function* () {
      yield* requireStaff("Only moderators can view the moderation queues.");

      const reports = yield* db.execute(
        db
          .selectFrom("post_reports")
          .innerJoin("posts", "posts.id", "post_reports.postId")
          .innerJoin("user", "user.id", "post_reports.userId")
          .select([
            "post_reports.createdAt",
            "post_reports.postId",
            "post_reports.reason",
            "posts.title as postTitle",
            "user.name as reporterName",
          ])
          .orderBy("post_reports.createdAt", "desc")
          .limit(MOD_QUEUE_LIMIT),
      );

      // Correlated subquery counts approvals per pending suggestion so the
      // UI can show "1/2 votes" without N+1 round trips.
      const pendingRows = yield* db.execute(
        db
          .selectFrom("post_edits")
          .innerJoin("posts", "posts.id", "post_edits.postId")
          .innerJoin("user", "user.id", "post_edits.suggestedBy")
          .select((eb) => [
            "post_edits.createdAt",
            "post_edits.id as editId",
            "post_edits.postId",
            "posts.title as postTitle",
            "user.name as suggestedByName",
            eb
              .selectFrom("post_edit_approvals")
              .select((eb2) => eb2.fn.countAll<number>().as("count"))
              .whereRef("post_edit_approvals.editId", "=", "post_edits.id")
              .as("approvals"),
          ])
          .where("post_edits.status", "=", "pending")
          .orderBy("post_edits.createdAt", "desc")
          .limit(MOD_QUEUE_LIMIT),
      );

      return {
        pendingEdits: pendingRows.map((row) => ({
          approvals: Number(row.approvals ?? 0),
          createdAt: toIsoTimestamp(row.createdAt),
          editId: row.editId,
          postId: row.postId,
          postTitle: row.postTitle,
          suggestedByName: row.suggestedByName,
        })),
        reports: reports.map((row) => ({
          createdAt: toIsoTimestamp(row.createdAt),
          postId: row.postId,
          postTitle: row.postTitle,
          reason: row.reason,
          reporterName: row.reporterName,
        })),
      };
    });

    const setUserRole = Effect.fn("ModerationService.setUserRole")(
      function* (input: { role: string; userId: string }) {
        const sessions = yield* SessionService;
        const actor = yield* sessions.requireActor("You must be logged in.");
        yield* authorize({
          actor,
          permission: "roles:assign",
          forbiddenMessage: "Only admins can assign roles.",
        });
        yield* requireRecentSignIn({ actor });

        const targetRole = Option.match(
          Schema.decodeUnknownOption(RoleSchema)(input.role),
          {
            onNone: () => null,
            onSome: (value): Role => value,
          },
        );
        if (targetRole === null) {
          return yield* new ForbiddenError({
            message: `Unknown role "${input.role}".`,
          });
        }

        const previousRole = yield* db.transaction((trx) =>
          Effect.gen(function* () {
            const activeAdminIds = yield* lockActiveAdminIds(trx);
            const target = yield* trx.executeTakeFirstOption(
              trx
                .selectFrom("user")
                .select(["id", "role"])
                .where("id", "=", input.userId),
            );
            if (Option.isNone(target) || target.value.role === targetRole) {
              // Idempotent no-op: assigning the current rank changes nothing.
              return Option.none<string>();
            }

            if (targetRole !== "admin") {
              yield* ensureAdminRemains({
                activeAdminIds,
                departingUserId: input.userId,
                message:
                  "At least one active admin must remain. Promote another admin first.",
              });
            }

            yield* trx.execute(
              trx
                .updateTable("user")
                .set({ role: targetRole })
                .where("id", "=", input.userId),
            );
            return Option.some(target.value.role);
          }),
        );
        if (Option.isNone(previousRole)) {
          return { userId: input.userId };
        }

        yield* Effect.logInfo("User role set").pipe(
          Effect.annotateLogs({
            previousRole: previousRole.value,
            setBy: actor.id,
            targetRole,
            targetUserId: input.userId,
          }),
        );
        return { userId: input.userId };
      },
    );

    const lockedTarget = Effect.fn("ModerationService.lockedTarget")(function* (
      trx: EffectTransaction<DB>,
      userId: string,
    ) {
      const target = yield* trx.executeTakeFirstOption(
        trx
          .selectFrom("user")
          .select(["id", "role", "suspendedAt"])
          .where("id", "=", userId)
          .forUpdate(),
      );
      if (Option.isNone(target)) {
        return yield* new UserNotFoundError({
          message: `User ${userId} not found`,
          userId,
        });
      }
      return target.value;
    });

    const requireRightsOver = Effect.fn("ModerationService.requireRightsOver")(
      function* (input: {
        readonly actor: AuthorizedActor;
        readonly targetRole: Role;
      }) {
        if (!roleHasPermission(input.targetRole, "users:suspend")) {
          return;
        }
        yield* authorize({
          actor: input.actor,
          permission: "users:suspend-staff",
          forbiddenMessage:
            "Only admins can suspend or restore moderators and admins.",
        });
        yield* requireRecentSignIn({ actor: input.actor });
      },
    );

    const suspendUser = Effect.fn("ModerationService.suspendUser")(
      function* (input: { reason: string; userId: string }) {
        const sessions = yield* SessionService;
        const actor = yield* sessions.requireActor("You must be logged in.");
        yield* authorize({
          actor,
          permission: "users:suspend",
          forbiddenMessage: "Only moderators and admins can suspend accounts.",
        });
        if (input.userId === actor.id) {
          return yield* new ValidationError({
            message: "You cannot suspend your own account.",
          });
        }
        const reason = input.reason.trim();
        if (reason === "") {
          return yield* new ValidationError({
            message: "A reason is required to suspend an account.",
          });
        }
        const now = yield* DateTime.now;

        yield* db.transaction((trx) =>
          Effect.gen(function* () {
            const activeAdminIds = yield* lockActiveAdminIds(trx);
            const target = yield* lockedTarget(trx, input.userId);
            yield* requireRightsOver({ actor, targetRole: target.role });
            if (target.suspendedAt !== null) {
              return;
            }
            yield* ensureAdminRemains({
              activeAdminIds,
              departingUserId: input.userId,
              message:
                "At least one active admin must remain. Suspend another admin first.",
            });
            yield* trx.execute(
              trx
                .updateTable("user")
                .set({
                  suspendedAt: DateTime.toDate(now),
                  suspendedReason: reason,
                })
                .where("id", "=", input.userId),
            );
          }),
        );

        yield* Effect.logInfo("User suspended").pipe(
          Effect.annotateLogs({
            suspendedBy: actor.id,
            targetUserId: input.userId,
          }),
        );
        return { userId: input.userId };
      },
    );

    const unsuspendUser = Effect.fn("ModerationService.unsuspendUser")(
      function* (input: { userId: string }) {
        const sessions = yield* SessionService;
        const actor = yield* sessions.requireActor("You must be logged in.");
        yield* authorize({
          actor,
          permission: "users:suspend",
          forbiddenMessage: "Only moderators and admins can restore accounts.",
        });

        yield* db.transaction((trx) =>
          Effect.gen(function* () {
            const target = yield* lockedTarget(trx, input.userId);
            yield* requireRightsOver({ actor, targetRole: target.role });
            if (target.suspendedAt === null) {
              return;
            }
            yield* trx.execute(
              trx
                .updateTable("user")
                .set({ suspendedAt: null, suspendedReason: null })
                .where("id", "=", input.userId),
            );
          }),
        );

        yield* Effect.logInfo("User unsuspended").pipe(
          Effect.annotateLogs({
            restoredBy: actor.id,
            targetUserId: input.userId,
          }),
        );
        return { userId: input.userId };
      },
    );

    return { overview, setUserRole, suspendUser, unsuspendUser };
  }),
}) {}

export const ModerationServiceLive = Layer.effect(
  ModerationService,
  ModerationService.make,
);

export const fetchModerationOverview = createServerFn().handler(
  createEndpointHandler({
    service: ModerationService,
    operation: "overview",
    layer: ModerationServiceLive,
    base: baseLayerFactories.auth,
  }),
);

export const suspendUser = createServerFn({ method: "POST" })
  .validator(
    parseStrict(
      Schema.Struct({
        reason: Schema.String.pipe(
          Schema.check(Schema.isMinLength(3)),
          Schema.check(Schema.isMaxLength(500)),
        ),
        userId: Schema.String,
      }),
    ),
  )
  .handler(
    createEndpointHandler({
      service: ModerationService,
      operation: "suspendUser",
      layer: ModerationServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const unsuspendUser = createServerFn({ method: "POST" })
  .validator(parseStrict(Schema.Struct({ userId: Schema.String })))
  .handler(
    createEndpointHandler({
      service: ModerationService,
      operation: "unsuspendUser",
      layer: ModerationServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const assignUserRole = createServerFn({ method: "POST" })
  .validator(
    parseStrict(Schema.Struct({ role: Schema.String, userId: Schema.String })),
  )
  .handler(
    createEndpointHandler({
      service: ModerationService,
      operation: "setUserRole",
      layer: ModerationServiceLive,
      base: baseLayerFactories.auth,
    }),
  );
