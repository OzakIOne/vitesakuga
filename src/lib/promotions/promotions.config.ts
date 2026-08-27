/**
 * Thresholds for the novice → uploader promotion. Tuning happens here, in
 * one reviewed diff. Keep consistent with the points barème in
 * `src/lib/points/points.config.ts`: ~300 points ≈ 8 decent uploads with
 * some traction, or a longer tail of comments and likes.
 */
export const PROMOTION_RULES = {
  /** Lifetime points required before a novice becomes reviewable. */
  minPoints: 300,
  /** Account must be older than this many days, so drive-by accounts cannot rush the queue. */
  minAccountAgeDays: 7,
} as const;
