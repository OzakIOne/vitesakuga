import { Effect } from "effect";
import type { Expression, ExpressionBuilder, SqlBool } from "kysely";

import type { DB } from "../db/kysely";
import type { EffectKysely } from "../effect/effect.utils";

export function mapPopularTags(
  t: { id: number; name: string; postCount: number | bigint | string }[],
) {
  return t.map((r) => ({
    id: r.id,
    name: r.name,
    postCount: Number(r.postCount),
  }));
}

/**
 * Popular tags (top 10 by tagged-post count) among a filtered set of posts.
 * Shared by every "tags within scope" endpoint; callers express the scope as
 * predicates over the joined `posts` table. Note `TagsService.popular` is
 * deliberately NOT built on this: it left-joins so zero-count tags appear.
 */
export const fetchPopularTagsForPosts = Effect.fn("fetchPopularTagsForPosts")(
  function* (
    db: EffectKysely<DB>,
    predicates: readonly ((
      eb: ExpressionBuilder<DB, "posts">,
    ) => Expression<SqlBool>)[],
  ) {
    let query = db
      .selectFrom("tags")
      .innerJoin("post_tags", "tags.id", "post_tags.tagId")
      .innerJoin("posts", "posts.id", "post_tags.postId");

    for (const predicate of predicates) {
      query = query.where(predicate);
    }

    const rows = yield* db.execute(
      query
        .select([
          "tags.id",
          "tags.name",
          db.fn.count("post_tags.postId").as("postCount"),
        ])
        .groupBy(["tags.id", "tags.name"])
        .orderBy("postCount", "desc")
        .limit(10),
    );

    return mapPopularTags(rows);
  },
);
