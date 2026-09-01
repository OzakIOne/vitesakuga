import { Effect, Schema } from "effect";

import type { DB } from "../db/kysely";
import { postWithVotesSelectSchema } from "../db/schema";
import type { EffectKysely } from "../effect/effect.utils";
import { parse } from "../effect/schema.utils";
import { RowParseError } from "../errors";

export type VoteCountsMap = Map<number, { dislikes: number; likes: number }>;

export const fetchPostVoteCounts = Effect.fn("fetchPostVoteCounts")(function* (
  db: EffectKysely<DB>,
  postIds: readonly number[],
) {
  if (postIds.length === 0) {
    return new Map();
  }

  const rows = yield* db.execute(
    db
      .selectFrom("post_votes")
      .select((eb) => [
        "postId",
        eb.fn.countAll().filterWhere("vote", "=", "like").as("likes"),
        eb.fn.countAll().filterWhere("vote", "=", "dislike").as("dislikes"),
      ])
      .where("postId", "in", [...postIds])
      .groupBy("postId"),
  );

  return new Map(
    rows.map((row) => [
      row.postId,
      { dislikes: Number(row.dislikes), likes: Number(row.likes) },
    ]),
  );
});

/**
 * Merge aggregate vote counts onto parsed posts and validate the merged rows
 * against the public `PostWithVotes` shape. Shared by every endpoint that
 * lists posts (search, by-tag, user profiles); a decode failure here is an
 * internal integrity defect, hence `RowParseError`.
 */
export const mergeVoteCounts = Effect.fn("mergeVoteCounts")(function* (
  db: EffectKysely<DB>,
  posts: readonly { readonly id: number }[],
) {
  const counts = yield* fetchPostVoteCounts(
    db,
    posts.map((post) => post.id),
  );

  const withVotes = posts.map((post) => {
    const c = counts.get(post.id) ?? { dislikes: 0, likes: 0 };
    return { ...post, dislikes: c.dislikes, likes: c.likes };
  });

  return yield* Effect.try({
    // Decode validates the rows (normalizing timestamps to `Date`), then
    // re-encode so `createdAt` leaves as an ISO string — the wire format the
    // client's `PostWithVotes` type promises.
    try: () => {
      const decoded = parse(Schema.Array(postWithVotesSelectSchema))(withVotes);
      return Schema.encodeSync(Schema.Array(postWithVotesSelectSchema))(
        decoded,
      );
    },
    catch: (error) =>
      new RowParseError({
        message: `Error processing post vote counts: ${String(error)}`,
        cause: error,
      }),
  });
});
