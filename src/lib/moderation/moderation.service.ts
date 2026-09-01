import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer, Option, Schema } from "effect";

import { getUserRole, userHasPermission } from "../auth/policy";
import { RoleSchema, roleAtLeast, type Role } from "../auth/roles";
import { SessionFetchError, SessionService } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { SqlError } from "../effect/effect.utils";
import { parseStrict } from "../effect/schema.utils";
import { ForbiddenError, UnauthorizedError } from "../errors";
import { baseLayerFactories, createHandler } from "../server-fn.handler";

const MOD_QUEUE_LIMIT = 50;

/** A recent post report, joined with its post title and reporter name. */
export type ModerationReportRow = {
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
  | ForbiddenError
  | SessionFetchError
  | SqlError
  | UnauthorizedError;

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
  }
>()("ModerationService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;

    /** Shared staff gate: signed-in user at moderator rank or above. */
    const requireStaff = (message: string) =>
      Effect.flatMap(SessionService, (sessions) =>
        Effect.flatMap(sessions.requireUser(message), (user) =>
          roleAtLeast(getUserRole(user), "moderator")
            ? Effect.succeed(user)
            : new ForbiddenError({ message }),
        ),
      );

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
          createdAt: row.createdAt.toISOString(),
          editId: row.editId,
          postId: row.postId,
          postTitle: row.postTitle,
          suggestedByName: row.suggestedByName,
        })),
        reports: reports.map((row) => ({
          createdAt: row.createdAt.toISOString(),
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
        const actor = yield* sessions.requireUser("You must be logged in.");

        if (!roleAtLeast(getUserRole(actor), "admin")) {
          return yield* new ForbiddenError({
            message: "Only admins can assign roles.",
          });
        }

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

        // SAFETY: the actor's shape satisfies the policy decoder (same contract
        // as every other service call site); this cast restates it for getUserRole.
        void userHasPermission;

        const targetOption = yield* db.executeTakeFirstOption(
          db
            .selectFrom("user")
            .select(["id", "role"])
            .where("id", "=", input.userId),
        );
        if (
          Option.isNone(targetOption) ||
          targetOption.value.role === targetRole
        ) {
          // Idempotent no-op: assigning the current rank changes nothing.
          return { userId: input.userId };
        }

        yield* db.execute(
          db
            .updateTable("user")
            .set({ role: targetRole })
            .where("id", "=", input.userId),
        );

        yield* Effect.logInfo("User role set").pipe(
          Effect.annotateLogs({
            previousRole: targetOption.value.role,
            setBy: actor.id,
            targetRole,
            targetUserId: input.userId,
          }),
        );
        return { userId: input.userId };
      },
    );

    return { overview, setUserRole };
  }),
}) {
  static readonly overview = Effect.fn("ModerationService.overview")(
    function* () {
      const svc = yield* ModerationService;
      return yield* svc.overview();
    },
  );

  static readonly setUserRole = Effect.fn("ModerationService.setUserRole")(
    function* (input: { role: string; userId: string }) {
      const svc = yield* ModerationService;
      return yield* svc.setUserRole(input);
    },
  );
}

export const ModerationServiceLive = Layer.effect(
  ModerationService,
  ModerationService.make,
);

export const fetchModerationOverview = createServerFn().handler(
  createHandler(
    ModerationServiceLive,
    baseLayerFactories.auth,
  )(ModerationService.overview),
);

export const assignUserRole = createServerFn({ method: "POST" })
  .validator(
    parseStrict(Schema.Struct({ role: Schema.String, userId: Schema.String })),
  )
  .handler(
    createHandler(
      ModerationServiceLive,
      baseLayerFactories.auth,
    )((input: { role: string; userId: string }) =>
      ModerationService.setUserRole(input),
    ),
  );
