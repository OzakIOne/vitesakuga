import { Effect } from "effect";

import type { DB } from "../db/kysely";
import type { EffectKysely } from "../effect/effect.utils";

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
