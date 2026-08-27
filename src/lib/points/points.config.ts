import { Schema } from "effect";

/**
 * Every event that can earn points. Adding an action here widens the union;
 * the ledger rows store this tag so history stays auditable.
 */
export const pointActionSchema = Schema.Literals([
  "comment-written",
  "edit-suggestion-approved",
  "post-like-received",
  "post-upload",
]);

export type PointAction = typeof pointActionSchema.Type;

type PointRuleDefinition = {
  /**
   * Max times the action can earn points for one user per day. Likes
   * received have a generous cap (others control them, but alt-account
   * self-liking must not scale infinitely); authored actions are tighter.
   */
  readonly dailyCap: number;
  /** Points granted per event. */
  readonly points: number;
};

/**
 * The points barème. Deliberately plain constants: tuning happens here, in
 * one reviewed diff, instead of a settings table nobody asked for yet.
 *
 * Rough journey to uploader (Phase 3 threshold ~300 points): ~8 uploads with
 * traction or a long tail of comments and likes on honest contributions.
 * Giving a like earns nothing — only receiving one does, so accounts cannot
 * farm their own posts.
 */
export const POINTS_RULES = {
  "comment-written": { dailyCap: 10, points: 2 },
  // Capped to blunt collusion rings where uploaders mass-approve each other's
  // suggestions; the dedupe key (suggester × edit) still pays only once.
  "edit-suggestion-approved": { dailyCap: 5, points: 10 },
  "post-like-received": { dailyCap: 50, points: 5 },
  "post-upload": { dailyCap: 3, points: 25 },
} as const satisfies Record<PointAction, PointRule>;

export type PointRule = PointRuleDefinition;
