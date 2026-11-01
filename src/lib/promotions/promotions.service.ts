import { createServerFn } from "@tanstack/react-start";
import { Clock, Context, Effect, Layer, Option, Schema } from "effect";

import {
  CommunityActivityService,
  CommunityActivityServiceLive,
} from "../activity/community-activity.service";
import { requirePermission, type PolicyError } from "../auth/policy";
import { SessionService } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { SqlError } from "../db/effect-kysely";
import { parseStrict } from "../effect/schema.utils";
import {
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
  readonly createdAt: Date;
  readonly totalPoints: number | null;
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
      PolicyError | PromotionAlreadyReviewedError | SqlError,
      SessionService
    >;
  }
>()("PromotionsService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;
    const sessions = yield* SessionService;
    const community = yield* CommunityActivityService;

    const gateStaff = () =>
      requirePermission("promotions:review", {
        forbiddenMessage: "Only moderators can review promotion candidates.",
      });

    const isOldEnough = (createdAt: Date, now: number): boolean =>
      // SAFETY: createdAt comes from Postgres timestamps; valueOf() is finite
      // for every row we insert, so subtraction cannot produce NaN here.
      now - new Date(createdAt).valueOf() >= MIN_ACCOUNT_AGE_MS;

    const reviewsForUsers = (userIds: ReadonlyArray<string>) =>
      db.execute(
        db
          .selectFrom("promotion_reviews")
          .select(["userId", "status", "pointsAtReview", "createdAt"])
          .where(
            "userId",
            "in",
            userIds.map((id) => id),
          )
          .orderBy("createdAt", "asc"),
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
      yield* gateStaff();

      const now = yield* Clock.currentTimeMillis;
      const rows: ReadonlyArray<QueueRow> = yield* db.execute(
        db
          .selectFrom("user")
          .leftJoin("points_ledger", "points_ledger.userId", "user.id")
          .select((eb) => [
            "user.id as userId",
            "user.name",
            "user.createdAt",
            eb.fn.sum<number>("points").as("totalPoints"),
          ])
          .where("user.role", "=", "novice")
          .where("user.deletedAt", "is", null)
          .groupBy(["user.id", "user.name", "user.createdAt"]),
      );

      // Points + age thresholds first — the cheap filters.
      const eligible = rows.filter(
        (row) =>
          Number(row.totalPoints ?? 0) >= PROMOTION_RULES.minPoints &&
          isOldEnough(row.createdAt, now),
      );
      if (eligible.length === 0) {
        return [];
      }

      const ids = eligible.map((row) => row.userId);
      const reviews = yield* reviewsForUsers(ids);
      // Latest review per candidate decides whether they stay hidden.
      const lastReviewById = new Map<string, (typeof reviews)[number]>();
      for (const review of reviews) {
        lastReviewById.set(review.userId, review);
      }

      const queued = eligible.filter((row) => {
        const lastReview = lastReviewById.get(row.userId);
        if (!lastReview) return true;
        if (lastReview.status === "approved") return false;
        // Rejected candidates come back once they out-earn their rejection
        // snapshot, so progress is never permanently locked away.
        return Number(row.totalPoints ?? 0) > lastReview.pointsAtReview;
      });

      return yield* Effect.forEach(queued, (row) =>
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

    /** Fetches the candidate and fails unless they are still awaiting review. */
    const requireAwaitingNovice = (targetUserId: string) =>
      db
        .executeTakeFirstOption(
          db
            .selectFrom("user")
            .select(["id", "role"])
            .where("id", "=", targetUserId),
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

    const approve = Effect.fn("PromotionsService.approve")(function* ({
      userId: targetUserId,
    }: {
      userId: string;
    }) {
      yield* gateStaff();
      const reviewer = yield* sessions.requireUser(
        "You must be logged in to review promotions",
      );

      // Re-check eligibility and consume the novice state atomically: two
      // moderators may approve the same stale queue entry at the same time.
      const total = yield* db.transaction((trx) =>
        Effect.gen(function* () {
          const target = yield* trx.executeTakeFirstOption(
            trx
              .selectFrom("user")
              .select(["id", "role"])
              .where("id", "=", targetUserId)
              .forUpdate(),
          );
          if (Option.isNone(target) || target.value.role !== "novice") {
            return yield* new PromotionAlreadyReviewedError({
              message: `User ${targetUserId} is not awaiting promotion`,
            });
          }

          const pointsRow = yield* trx.executeTakeFirstOrUndefined(
            trx
              .selectFrom("points_ledger")
              .select((eb) => eb.fn.sum<number>("points").as("total"))
              .where("userId", "=", targetUserId),
          );
          const total = Number(pointsRow?.total ?? 0);
          if (total < PROMOTION_RULES.minPoints) {
            return yield* new PromotionNotEligibleError({
              message: `Candidate has ${total} points but ${PROMOTION_RULES.minPoints} are required`,
            });
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
              pointsAtReview: total,
              reviewedBy: reviewer.id,
              status: "approved",
              userId: targetUserId,
            }),
          );
          return total;
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
      yield* gateStaff();
      const reviewer = yield* sessions.requireUser(
        "You must be logged in to review promotions",
      );

      yield* requireAwaitingNovice(targetUserId);

      const total = yield* community.totalPoints(targetUserId);

      yield* db.execute(
        db.insertInto("promotion_reviews").values({
          pointsAtReview: total,
          reviewedBy: reviewer.id,
          status: "rejected",
          userId: targetUserId,
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
