import { createServerFn } from "@tanstack/react-start";
import { Clock, Context, Effect, Layer, Option, Schema } from "effect";

import {
  CommunityActivityService,
  CommunityActivityServiceLive,
} from "../activity/community-activity.service";
import { authorize, type PolicyError } from "../auth/policy";
import { SessionService, type AuthorizedActor } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { SqlError, type EffectTransaction } from "../db/effect-kysely";
import type { DB } from "../db/kysely";
import { parseStrict } from "../effect/schema.utils";
import {
  AccountSuspendedError,
  PromotionAlreadyReviewedError,
  PromotionNotEligibleError,
} from "../errors";
import { createEndpointHandler } from "../server-endpoint";
import { baseLayerFactories } from "../server-fn.handler";
import { PROMOTION_RULES } from "./promotions.config";

/** Account age floor in wall-clock milliseconds. */
const MIN_ACCOUNT_AGE_MS = PROMOTION_RULES.minAccountAgeDays * 86_400_000;

export type PromotionCandidate = {
  readonly activity: {
    readonly comments: number;
    readonly likesReceived: number;
    readonly uploads: number;
  };
  readonly name: string;
  readonly totalPoints: number;
  readonly userId: string;
};

type QueueRow = {
  readonly userId: string;
  readonly name: string;
  readonly role: string;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;
  readonly totalPoints: number | null;
};

/** Both the root connection and an open transaction satisfy these reads. */
type PromotionExecutor = Pick<
  EffectTransaction<DB>,
  | "execute"
  | "executeTakeFirstOption"
  | "executeTakeFirstOrUndefined"
  | "selectFrom"
>;

type LatestReview = {
  readonly pointsAtReview: number;
  readonly status: string;
};

type EligibilityFacts = {
  readonly createdAt: Date;
  readonly deletedAt: Date | null;
  readonly latestReview: LatestReview | undefined;
  readonly role: string;
  readonly totalPoints: number;
};

/**
 * The one promotion rule, shared by the queue and approval so they cannot
 * drift. Returns the first unmet condition, worded for the reviewer, or
 * `undefined` when the candidate may be promoted.
 */
const unmetPromotionCondition = (
  facts: EligibilityFacts,
  now: number,
): string | undefined => {
  if (facts.role !== "novice") {
    return "Candidate is no longer a novice";
  }
  if (facts.deletedAt !== null) {
    return "Account has been deleted";
  }
  if (now - facts.createdAt.getTime() < MIN_ACCOUNT_AGE_MS) {
    return `Account must be at least ${PROMOTION_RULES.minAccountAgeDays} days old`;
  }
  if (facts.totalPoints < PROMOTION_RULES.minPoints) {
    return `Candidate has ${facts.totalPoints} points but ${PROMOTION_RULES.minPoints} are required`;
  }
  if (facts.latestReview?.status === "approved") {
    return "Candidate was already approved";
  }
  if (
    facts.latestReview?.status === "rejected" &&
    facts.totalPoints <= facts.latestReview.pointsAtReview
  ) {
    return `Candidate was rejected at ${facts.latestReview.pointsAtReview} points and needs more than that to be reconsidered`;
  }
  return undefined;
};

// oxlint-disable effecttsgo/global-date -- account-age and readAt math compare wall-clock timestamps against Postgres Date rows; the Effect DateTime equivalent needs the same Date round-trip

export class PromotionsService extends Context.Service<
  PromotionsService,
  {
    /**
     * Staff-only live review queue: every novice whose points crossed
     * `PROMOTION_RULES.minPoints` with an account older than
     * `minAccountAgeDays`, minus already-reviewed candidates.
     */
    readonly queue: () => Effect.Effect<
      ReadonlyArray<PromotionCandidate>,
      PolicyError | SqlError,
      SessionService
    >;

    /**
     * Staff-only: promotes a novice to uploader. Re-checks eligibility so a
     * stale queue entry cannot promote an under-qualified user.
     */
    readonly approve: (input: {
      userId: string;
    }) => Effect.Effect<
      { userId: string },
      | AccountSuspendedError

      | PolicyError
      | PromotionAlreadyReviewedError
      | PromotionNotEligibleError
      | SqlError,
      SessionService
    >;

    /**
     * Staff-only: declines a candidate. Records their current points so they
     * re-enter the queue only after earning more than that snapshot.
     */
    readonly reject: (input: {
      userId: string;
    }) => Effect.Effect<
      { userId: string },
      AccountSuspendedError | PolicyError | PromotionAlreadyReviewedError | SqlError,
      SessionService
    >;
  }
>()("PromotionsService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;
    const sessions = yield* SessionService;
    const community = yield* CommunityActivityService;

    const authorizeReview = Effect.fn("PromotionsService.authorizeReview")(
      function* (reviewer: AuthorizedActor) {
        yield* authorize({
          actor: reviewer,
          permission: "promotions:review",
          forbiddenMessage: "Only moderators can review promotion candidates.",
        });
        return reviewer;
      },
    );

    const gateStaffRead = Effect.fn("PromotionsService.gateStaffRead")(
      function* () {
        const reviewer = yield* sessions.requireReadActor(
          "You must be logged in.",
        );
        return yield* authorizeReview(reviewer);
      },
    );

    const gateStaff = Effect.fn("PromotionsService.gateStaff")(function* () {
      const reviewer = yield* sessions.requireActor("You must be logged in.");
      return yield* authorizeReview(reviewer);
    });

    const latestReviewsFor = (
      executor: PromotionExecutor,
      userIds: ReadonlyArray<string>,
    ) =>
      Effect.gen(function* () {
        const latest = new Map<string, LatestReview>();
        if (userIds.length === 0) {
          return latest;
        }
        const reviews = yield* executor.execute(
          executor
            .selectFrom("promotion_reviews")
            .select(["userId", "status", "pointsAtReview"])
            .where(
              "userId",
              "in",
              userIds.map((id) => id),
            )
            .orderBy("createdAt", "asc"),
        );
        for (const review of reviews) {
          latest.set(review.userId, review);
        }
        return latest;
      });

    const lifetimePoints = (executor: PromotionExecutor, userId: string) =>
      executor
        .executeTakeFirstOrUndefined(
          executor
            .selectFrom("points_ledger")
            .select((eb) => eb.fn.sum<number>("points").as("total"))
            .where("userId", "=", userId),
        )
        .pipe(Effect.map((row) => Number(row?.total ?? 0)));

    /** Locks the candidate row and fails unless they are still awaiting review. */
    const lockAwaitingCandidate = (
      executor: PromotionExecutor,
      targetUserId: string,
    ) =>
      executor
        .executeTakeFirstOption(
          executor
            .selectFrom("user")
            .select(["id", "role", "createdAt", "deletedAt"])
            .where("id", "=", targetUserId)
            .forUpdate(),
        )
        .pipe(
          Effect.flatMap((target) =>
            Option.isSome(target) && target.value.role === "novice"
              ? Effect.succeed(target.value)
              : new PromotionAlreadyReviewedError({
                  message: `User ${targetUserId} is not awaiting promotion`,
                }),
          ),
        );

    const uploadsCount = (candidateId: string) =>
      db.executeTakeFirstOrUndefined(
        db
          .selectFrom("posts")
          .select((eb) => eb.fn.countAll<number>().as("count"))
          .where("userId", "=", candidateId),
      );

    const likesReceivedCount = (candidateId: string) =>
      db.executeTakeFirstOrUndefined(
        db
          .selectFrom("post_votes")
          .innerJoin("posts", "posts.id", "post_votes.postId")
          .select((eb) => eb.fn.countAll<number>().as("count"))
          .where("posts.userId", "=", candidateId)
          .where("post_votes.vote", "=", "like"),
      );

    const commentsCount = (candidateId: string) =>
      db.executeTakeFirstOrUndefined(
        db
          .selectFrom("comments")
          .innerJoin("posts", "posts.id", "comments.postId")
          .select((eb) => eb.fn.countAll<number>().as("count"))
          .where("posts.userId", "=", candidateId),
      );

    const queue = Effect.fn("PromotionsService.queue")(function* () {
      yield* gateStaffRead();

      const now = yield* Clock.currentTimeMillis;
      const rows: ReadonlyArray<QueueRow> = yield* db.execute(
        db
          .selectFrom("user")
          .leftJoin("points_ledger", "points_ledger.userId", "user.id")
          .select((eb) => [
            "user.id as userId",
            "user.name",
            "user.role",
            "user.createdAt",
            "user.deletedAt",
            eb.fn.sum<number>("points").as("totalPoints"),
          ])
          .where("user.role", "=", "novice")
          .where("user.deletedAt", "is", null)
          .groupBy(["user.id", "user.name", "user.createdAt"]),
      );

      const latestReviews = yield* latestReviewsFor(
        db,
        rows.map((row) => row.userId),
      );
      const eligible = rows.filter(
        (row) =>
          unmetPromotionCondition(
            {
              createdAt: row.createdAt,
              deletedAt: row.deletedAt,
              latestReview: latestReviews.get(row.userId),
              role: row.role,
              totalPoints: Number(row.totalPoints ?? 0),
            },
            now,
          ) === undefined,
      );

      return yield* Effect.forEach(eligible, (row) =>
        Effect.gen(function* () {
          const [uploads, likesReceived, comments] = yield* Effect.all([
            uploadsCount(row.userId),
            likesReceivedCount(row.userId),
            commentsCount(row.userId),
          ]);
          return {
            activity: {
              comments: Number(comments?.count ?? 0),
              likesReceived: Number(likesReceived?.count ?? 0),
              uploads: Number(uploads?.count ?? 0),
            },
            name: row.name,
            totalPoints: Number(row.totalPoints ?? 0),
            userId: row.userId,
          } as const satisfies PromotionCandidate;
        }),
      );
    });

    const approve = Effect.fn("PromotionsService.approve")(function* ({
      userId: targetUserId,
    }: {
      userId: string;
    }) {
      const reviewer = yield* gateStaff();

      const now = yield* Clock.currentTimeMillis;
      // Re-check eligibility and consume the novice state atomically: two
      // moderators may approve the same stale queue entry at the same time.
      const total = yield* db.transaction((trx) =>
        Effect.gen(function* () {
          const target = yield* lockAwaitingCandidate(trx, targetUserId);
          const totalPoints = yield* lifetimePoints(trx, targetUserId);
          const latestReviews = yield* latestReviewsFor(trx, [targetUserId]);
          const unmet = unmetPromotionCondition(
            {
              createdAt: target.createdAt,
              deletedAt: target.deletedAt,
              latestReview: latestReviews.get(targetUserId),
              role: target.role,
              totalPoints,
            },
            now,
          );
          if (unmet !== undefined) {
            return yield* new PromotionNotEligibleError({ message: unmet });
          }

          yield* trx.execute(
            trx
              .updateTable("user")
              .set({ role: "uploader" })
              .where("id", "=", targetUserId)
              .where("role", "=", "novice"),
          );

          yield* trx.execute(
            trx.insertInto("promotion_reviews").values({
              pointsAtReview: totalPoints,
              reviewedBy: reviewer.id,
              status: "approved",
              userId: targetUserId,
            }),
          );
          return totalPoints;
        }),
      );

      yield* community.record({
        _tag: "PromotionApproved",
        userId: targetUserId,
      });

      yield* Effect.logInfo("Promotion approved").pipe(
        Effect.annotateLogs({
          reviewerId: reviewer.id,
          totalPoints: String(total),
          userId: targetUserId,
        }),
      );
      return { userId: targetUserId };
    });

    const reject = Effect.fn("PromotionsService.reject")(function* ({
      userId: targetUserId,
    }: {
      userId: string;
    }) {
      const reviewer = yield* gateStaff();

      // Locks the candidate like approval does, so a concurrent approval and
      // rejection cannot both record a decision.
      const total = yield* db.transaction((trx) =>
        Effect.gen(function* () {
          yield* lockAwaitingCandidate(trx, targetUserId);
          const totalPoints = yield* lifetimePoints(trx, targetUserId);
          yield* trx.execute(
            trx.insertInto("promotion_reviews").values({
              pointsAtReview: totalPoints,
              reviewedBy: reviewer.id,
              status: "rejected",
              userId: targetUserId,
            }),
          );
          return totalPoints;
        }),
      );

      yield* community.record({
        _tag: "PromotionRejected",
        userId: targetUserId,
      });

      yield* Effect.logInfo("Promotion rejected").pipe(
        Effect.annotateLogs({
          reviewerId: reviewer.id,
          totalPoints: String(total),
          userId: targetUserId,
        }),
      );
      return { userId: targetUserId };
    });

    return { queue, approve, reject };
  }),
}) {}

export const PromotionsServiceLive = Layer.effect(
  PromotionsService,
  PromotionsService.make,
).pipe(Layer.provideMerge(CommunityActivityServiceLive));

export const fetchPromotionQueue = createServerFn().handler(
  createEndpointHandler({
    service: PromotionsService,
    operation: "queue",
    layer: PromotionsServiceLive,
    base: baseLayerFactories.auth,
  }),
);

export const approvePromotion = createServerFn({ method: "POST" })
  .validator(parseStrict(Schema.Struct({ userId: Schema.String })))
  .handler(
    createEndpointHandler({
      service: PromotionsService,
      operation: "approve",
      layer: PromotionsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const rejectPromotion = createServerFn({ method: "POST" })
  .validator(parseStrict(Schema.Struct({ userId: Schema.String })))
  .handler(
    createEndpointHandler({
      service: PromotionsService,
      operation: "reject",
      layer: PromotionsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );
