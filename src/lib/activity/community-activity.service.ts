import { Context, Effect, Layer, Match } from "effect";

import { KyselyDB } from "../db/context";
import type { EffectTransaction, SqlError } from "../db/effect-kysely";
import type { DB } from "../db/kysely";
import {
  canonicalizeMentionContent,
  extractPlainMentionHandles,
} from "../mentions/mentions";
import {
  NotificationsService,
  NotificationsServiceLive,
  type NotificationType,
} from "../notifications/notifications.service";
import {
  PointsService,
  PointsServiceLive,
  type AwardInput,
} from "../points/points.service";

// Each resolved mention fans out into a mention row and a notification, so the
// count is capped per comment (security audit M2). The cap also covers ids that
// arrive inside pre-canonicalized tokens.
const MAX_MENTIONS_PER_COMMENT = 10;

/** Facts a domain service reports after its own change has committed. */
export type CommunityActivityEvent =
  | {
      readonly _tag: "PostUploaded";
      readonly authorId: string;
      readonly postId: number;
    }
  | {
      readonly _tag: "LikeReceived";
      readonly authorId: string;
      readonly postId: number;
      readonly voterId: string;
    }
  | {
      readonly _tag: "EditApproved";
      readonly editId: number;
      readonly postId: number;
      readonly postOwnerId: string;
      readonly suggestedById: string;
    }
  | {
      readonly _tag: "EditRejected";
      readonly postId: number;
      readonly suggestedById: string;
    }
  | { readonly _tag: "PromotionApproved"; readonly userId: string }
  | { readonly _tag: "PromotionRejected"; readonly userId: string };

/**
 * Comment facts carry their resolved mentions: the mention rows are written
 * inside the comment's transaction, so they never reach `record`.
 */
export type CommentActivityEvent =
  | {
      readonly _tag: "CommentWritten";
      readonly authorId: string;
      readonly commentId: number;
      readonly postId: number;
      readonly mentionedUserIds: ReadonlyArray<string>;
    }
  | {
      readonly _tag: "CommentEdited";
      readonly commentId: number;
      readonly postId: number;
      readonly mentionedUserIds: ReadonlyArray<string>;
    };

export type CanonicalCommentMentions = {
  /** Content with every resolvable `@handle` stored as an id-based token. */
  readonly content: string;
  readonly mentionUserIds: ReadonlyArray<string>;
};

export class CommunityActivityService extends Context.Service<
  CommunityActivityService,
  {
    /**
     * Turns a committed domain fact into points and notifications. Best-effort:
     * a failing ledger write or inbox insert is logged, never raised, so the
     * user's action still succeeds.
     */
    readonly record: (event: CommunityActivityEvent) => Effect.Effect<void>;

    /**
     * Writes a comment's mention rows inside the comment's transaction, so the
     * content and its mention rows commit or roll back together. Points and
     * mention notifications run after that commit, best-effort.
     */
    readonly recordInTransaction: (
      trx: EffectTransaction<DB>,
      event: CommentActivityEvent,
    ) => Effect.Effect<void, SqlError>;

    /**
     * Resolves typed `@handle` mentions into stored tokens before the comment
     * row is written. Handles resolve against active users other than the
     * author; unknown handles stay plain text.
     */
    readonly canonicalizeCommentMentions: (args: {
      readonly authorId: string;
      readonly content: string;
    }) => Effect.Effect<CanonicalCommentMentions, SqlError>;

    /** Lifetime points, read through the module as a domain snapshot. */
    readonly totalPoints: (userId: string) => Effect.Effect<number, SqlError>;
  }
>()("CommunityActivityService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;
    const points = yield* PointsService;
    const notifications = yield* NotificationsService;

    const bestEffort = (
      label: string,
      effect: Effect.Effect<void, SqlError>,
    ): Effect.Effect<void> =>
      effect.pipe(
        Effect.catchTag("SqlError", (error) =>
          Effect.logError(`${label} failed`).pipe(
            Effect.annotateLogs({ error: String(error) }),
          ),
        ),
      );

    const award = (input: AwardInput) =>
      bestEffort(
        `Points award (${input.action})`,
        points.award(input).pipe(Effect.asVoid),
      );

    const notify = (args: {
      readonly userId: string;
      readonly type: NotificationType;
      readonly postId?: number;
    }) =>
      bestEffort(
        `Notification insert (${args.type})`,
        notifications.notify(args),
      );

    const canonicalizeCommentMentions = Effect.fn(
      "CommunityActivityService.canonicalizeCommentMentions",
    )(function* (args: {
      readonly authorId: string;
      readonly content: string;
    }) {
      const handles = extractPlainMentionHandles(args.content).slice(
        0,
        MAX_MENTIONS_PER_COMMENT,
      );
      const mentioned =
        handles.length === 0
          ? []
          : yield* db.execute(
              db
                .selectFrom("user")
                .select(["id", "username"])
                .where("deletedAt", "is", null)
                .where("username", "in", handles)
                .where("id", "!=", args.authorId),
            );
      const userIdByHandle = new Map(
        mentioned.map((row) => [row.username, row.id]),
      );
      const canonical = canonicalizeMentionContent(
        args.content,
        (handle) => userIdByHandle.get(handle) ?? null,
      );
      return {
        content: canonical.content,
        mentionUserIds: canonical.mentionUserIds.slice(
          0,
          MAX_MENTIONS_PER_COMMENT,
        ),
      } satisfies CanonicalCommentMentions;
    });

    /** Replaces the comment's mention rows; returns the users newly mentioned. */
    const rewriteMentionRows = Effect.fn(
      "CommunityActivityService.rewriteMentionRows",
    )(function* (
      trx: EffectTransaction<DB>,
      args: {
        readonly commentId: number;
        readonly mentionedUserIds: ReadonlyArray<string>;
      },
    ) {
      const previous = yield* trx.execute(
        trx
          .selectFrom("comment_mentions")
          .select("userId")
          .where("commentId", "=", args.commentId),
      );
      yield* trx.execute(
        trx
          .deleteFrom("comment_mentions")
          .where("commentId", "=", args.commentId),
      );
      if (args.mentionedUserIds.length > 0) {
        yield* trx.execute(
          trx
            .insertInto("comment_mentions")
            .values(
              args.mentionedUserIds.map((userId) => ({
                commentId: args.commentId,
                userId,
              })),
            )
            .onConflict((oc) => oc.doNothing()),
        );
      }
      const previouslyMentioned = new Set(previous.map((row) => row.userId));
      return args.mentionedUserIds.filter(
        (userId) => !previouslyMentioned.has(userId),
      );
    });

    const notifyNewMentions = Effect.fn(
      "CommunityActivityService.notifyNewMentions",
    )(function* (args: {
      readonly postId: number;
      readonly userIds: ReadonlyArray<string>;
    }) {
      if (args.userIds.length === 0) {
        return;
      }
      // Anonymized accounts have no inbox, so they are never notified.
      const active = yield* db.execute(
        db
          .selectFrom("user")
          .select("id")
          .where("deletedAt", "is", null)
          .where("id", "in", args.userIds),
      );
      for (const row of active) {
        yield* notify({
          postId: args.postId,
          type: "comment-mention",
          userId: row.id,
        });
      }
    });

    const recordInTransaction = Effect.fn(
      "CommunityActivityService.recordInTransaction",
    )(function* (trx: EffectTransaction<DB>, event: CommentActivityEvent) {
      const newlyMentioned = yield* rewriteMentionRows(trx, event);
      yield* trx.afterCommit(
        Effect.gen(function* () {
          if (event._tag === "CommentWritten") {
            yield* award({
              action: "comment-written",
              actorId: event.authorId,
              refId: event.commentId,
              userId: event.authorId,
            });
          }
          yield* bestEffort(
            "Comment mention notifications",
            notifyNewMentions({
              postId: event.postId,
              userIds: newlyMentioned,
            }),
          );
        }),
      );
    });

    const record = Effect.fn("CommunityActivityService.record")(function* (
      event: CommunityActivityEvent,
    ) {
      yield* Match.value(event).pipe(
        Match.tagsExhaustive({
          PostUploaded: (uploaded) =>
            award({
              action: "post-upload",
              actorId: uploaded.authorId,
              refId: uploaded.postId,
              userId: uploaded.authorId,
            }),
          // Authors earn nothing from their own post; the ledger dedupes
          // (author, post, voter), so toggling or re-liking never pays twice.
          LikeReceived: (like) =>
            like.authorId === like.voterId
              ? Effect.void
              : award({
                  action: "post-like-received",
                  actorId: like.voterId,
                  refId: like.postId,
                  userId: like.authorId,
                }),
          // The suggester is paid once per applied edit (dedupe on suggester ×
          // action × editId); the daily cap blunts collusion rings.
          EditApproved: (approved) =>
            Effect.gen(function* () {
              yield* award({
                action: "edit-suggestion-approved",
                refId: approved.editId,
                userId: approved.suggestedById,
              });
              yield* notify({
                postId: approved.postId,
                type: "edit-suggestion-applied",
                userId: approved.postOwnerId,
              });
              yield* notify({
                postId: approved.postId,
                type: "edit-suggestion-approved",
                userId: approved.suggestedById,
              });
            }),
          EditRejected: (rejected) =>
            notify({
              postId: rejected.postId,
              type: "edit-suggestion-rejected",
              userId: rejected.suggestedById,
            }),
          PromotionApproved: (promotion) =>
            notify({ type: "promotion-approved", userId: promotion.userId }),
          PromotionRejected: (promotion) =>
            notify({ type: "promotion-rejected", userId: promotion.userId }),
        }),
      );
    });

    const totalPoints = Effect.fn("CommunityActivityService.totalPoints")(
      function* (userId: string) {
        return yield* points.total(userId);
      },
    );

    return {
      canonicalizeCommentMentions,
      record,
      recordInTransaction,
      totalPoints,
    };
  }),
}) {}

export const CommunityActivityServiceLive = Layer.effect(
  CommunityActivityService,
  CommunityActivityService.make,
).pipe(
  Layer.provideMerge(PointsServiceLive),
  Layer.provideMerge(NotificationsServiceLive),
);
