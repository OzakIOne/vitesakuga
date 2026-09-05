import { Clock, Context, Effect, Layer } from "effect";

import { KyselyDB } from "../db/context";
import { SqlError } from "../effect/effect.utils";
import { startOfLocalDay } from "./local-day";
import { POINTS_RULES, type PointAction } from "./points.config";

export type AwardInput = {
  readonly userId: string;
  readonly action: PointAction;
  /**
   * Resource the points relate to (post id, comment id). Combined with
   * `actorId` it dedupes earnings: the same resource granted by the same
   * actor can never pay out twice, so remove-and-relike cycles farm nothing.
   */
  readonly refId?: number | undefined;
  readonly actorId?: string | undefined;
};

export type AwardOutcome =
  | { readonly kind: "awarded"; readonly points: number }
  | { readonly kind: "already-earned" }
  | { readonly kind: "daily-cap-reached" };

export class PointsService extends Context.Service<
  PointsService,
  {
    /** Records an earning event if caps and dedupe allow it. */
    readonly award: (
      input: AwardInput,
    ) => Effect.Effect<AwardOutcome, SqlError>;

    /**
     * Best-effort variant for hooks inside other services: a ledger failure
     * must never abort the user's upload/comment/vote, so errors are logged
     * and swallowed.
     */
    readonly awardOrLog: (input: AwardInput) => Effect.Effect<void>;

    /** Lifetime total across all actions. */
    readonly total: (userId: string) => Effect.Effect<number, SqlError>;
  }
>()("PointsService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;

    const countTodayEarnings = (userId: string, action: PointAction) =>
      Effect.gen(function* () {
        // Daily caps use calendar-day boundaries in the server's local
        // timezone so "today" matches user expectations. The instant comes
        // from the clock (so a TestClock controls the window deterministically
        // in tests); local midnight is resolved through the zone's own rules,
        // which stays correct across DST transitions.
        const now = yield* Clock.currentTimeMillis;
        // oxlint-disable-next-line effecttsgo/global-date-in-effect -- the instant comes from Clock; the Date wrapper only satisfies Kysely's Date-typed `createdAt` column
        const startOfToday = new Date(startOfLocalDay(now));

        return yield* db.executeTakeFirstOrUndefined(
          db
            .selectFrom("points_ledger")
            .select((eb) => eb.fn.countAll<number>().as("count"))
            .where("userId", "=", userId)
            .where("action", "=", action)
            .where("createdAt", ">=", startOfToday),
        );
      });

    const hasAlreadyEarned = (input: AwardInput) =>
      db.executeTakeFirstOrUndefined(
        db
          .selectFrom("points_ledger")
          .select("id")
          .where("userId", "=", input.userId)
          .where("action", "=", input.action)
          .$call((qb) =>
            input.refId === undefined
              ? qb
              : qb.where("refId", "=", input.refId),
          )
          .$call((qb) =>
            input.actorId === undefined
              ? qb
              : qb.where("actorId", "=", input.actorId),
          )
          .limit(1),
      );

    const award = Effect.fn("PointsService.award")(function* (
      input: AwardInput,
    ) {
      const rule = POINTS_RULES[input.action];

      if (yield* hasAlreadyEarned(input)) {
        return { kind: "already-earned" } as const satisfies AwardOutcome;
      }

      const todayCount = yield* countTodayEarnings(input.userId, input.action);
      if (Number(todayCount?.count ?? 0) >= rule.dailyCap) {
        return {
          kind: "daily-cap-reached",
        } as const satisfies AwardOutcome;
      }

      yield* db.execute(
        db.insertInto("points_ledger").values({
          action: input.action,
          actorId: input.actorId ?? null,
          // Stamp the row with the clock instant (the DB default `now()` is
          // wall-clock), so the daily-cap window and the rows it counts are
          // always derived from the same time source — deterministic under a
          // TestClock, identical to `now()` in production.
          // oxlint-disable-next-line effecttsgo/global-date-in-effect -- the instant comes from Clock; the Date wrapper only satisfies Kysely's Date-typed `createdAt` column
          createdAt: new Date(yield* Clock.currentTimeMillis),
          points: rule.points,
          refId: input.refId ?? null,
          userId: input.userId,
        }),
      );

      yield* Effect.logInfo("Points awarded").pipe(
        Effect.annotateLogs({
          action: input.action,
          points: String(rule.points),
          userId: input.userId,
        }),
      );
      return {
        kind: "awarded",
        points: rule.points,
      } as const satisfies AwardOutcome;
    });

    const awardOrLog = Effect.fn("PointsService.awardOrLog")(function* (
      input: AwardInput,
    ) {
      yield* award(input).pipe(
        Effect.catchTag("SqlError", (error) =>
          Effect.logError("Points award failed").pipe(
            Effect.annotateLogs({ error: String(error), ...input }),
          ),
        ),
      );
    });

    const total = Effect.fn("PointsService.total")(function* (userId: string) {
      const row = yield* db.executeTakeFirstOrUndefined(
        db
          .selectFrom("points_ledger")
          .select((eb) => eb.fn.sum<number>("points").as("total"))
          .where("userId", "=", userId),
      );
      return Number(row?.total ?? 0);
    });

    return { award, awardOrLog, total };
  }),
}) {
  static readonly award = Effect.fn("PointsService.award")(function* (
    input: AwardInput,
  ) {
    const svc = yield* PointsService;
    return yield* svc.award(input);
  });

  static readonly awardOrLog = Effect.fn("PointsService.awardOrLog")(function* (
    input: AwardInput,
  ) {
    const svc = yield* PointsService;
    return yield* svc.awardOrLog(input);
  });

  static readonly total = Effect.fn("PointsService.total")(function* (
    userId: string,
  ) {
    const svc = yield* PointsService;
    return yield* svc.total(userId);
  });
}

export const PointsServiceLive = Layer.effect(
  PointsService,
  PointsService.make,
);
