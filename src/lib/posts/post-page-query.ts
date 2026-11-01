import { Effect, Schema } from "effect";
import {
  sql,
  type Expression,
  type ExpressionBuilder,
  type SqlBool,
} from "kysely";

import type { EffectKysely } from "../db/effect-kysely";
import type { DB } from "../db/kysely";
import { postsSelectSchema } from "../db/schema";
import { parse } from "../effect/schema.utils";
import { RowParseError } from "../errors";
import { computePagination } from "../pagination/pagination";
import { fetchPopularTagsForPosts } from "../tags/tags.utils";
import { mergeVoteCounts } from "../votes/votes.utils";
import type { DiscoveryView } from "./posts.schema";
import type { NumericSearchFilter } from "./search-filters";
import { escapeLikePattern } from "./search-pattern";

const PAGE_SIZE = 30;

const DAY_MS = 86_400_000;
const FOLLOWED_TAGS_WINDOW_DAYS = 14;
const UNDER_SEEN_WINDOW_DAYS = 30;
const UNDER_SEEN_MAX_LIKES = 5;

type PostPredicate = (
  eb: ExpressionBuilder<DB, "posts">,
) => Expression<SqlBool>;

export type PostScope = readonly PostPredicate[];

const selectPostRows = (db: EffectKysely<DB>) =>
  db.selectFrom("posts").selectAll("posts");

type PostRowsQuery = ReturnType<typeof selectPostRows>;

export type PostOrdering = (query: PostRowsQuery) => PostRowsQuery;

const applyScope = (query: PostRowsQuery, scope: PostScope) => {
  let scoped = query;
  for (const predicate of scope) {
    scoped = scoped.where(predicate);
  }
  return scoped;
};

/**
 * One listing: the scope is applied to the count, the page rows and popular
 * tags alike, so the three cannot drift apart. Ordering is the caller's
 * choice and applies to the page rows only.
 */
export const fetchPostPage = Effect.fn("fetchPostPage")(function* (
  db: EffectKysely<DB>,
  input: {
    readonly includePopularTags: boolean;
    readonly ordering: PostOrdering;
    readonly page: number;
    readonly scope: PostScope;
  },
) {
  const scoped = applyScope(selectPostRows(db), input.scope);

  const countResult = yield* db.executeTakeFirstOrUndefined(
    scoped.clearSelect().select((eb) => eb.fn.countAll().as("count")),
  );
  const totalCount = Number(countResult?.count ?? 0);

  const pagination = computePagination(totalCount, {
    page: input.page,
    pageSize: PAGE_SIZE,
  });

  const items = yield* db.execute(
    input.ordering(scoped).offset(pagination.offset).limit(PAGE_SIZE),
  );

  const parsed = yield* Effect.try({
    try: () => parse(Schema.Array(postsSelectSchema))(items),
    catch: (error) =>
      new RowParseError({
        message: `Error processing post page: ${String(error)}`,
        cause: error,
      }),
  });

  const data = yield* mergeVoteCounts(db, parsed);

  const popularTags = input.includePopularTags
    ? yield* fetchPopularTagsForPosts(db, input.scope)
    : [];

  return { data, meta: { pagination, popularTags } };
});

const numericFilterExpression = (filter: NumericSearchFilter) => {
  const comparison = sql.raw(filter.operator);
  const value = filter.value;
  switch (filter.field) {
    case "width":
      return sql<boolean>`exists (select 1 from post_images pi where pi."postId" = posts.id and pi.width ${comparison} ${value})`;
    case "height":
      return sql<boolean>`exists (select 1 from post_images pi where pi."postId" = posts.id and pi.height ${comparison} ${value})`;
    case "video_width":
      return sql<boolean>`(posts."videoMetadata"->>'Width')::numeric ${comparison} ${value}`;
    case "video_height":
      return sql<boolean>`(posts."videoMetadata"->>'Height')::numeric ${comparison} ${value}`;
    case "likes":
    case "score":
      return sql<boolean>`(select count(*) from post_votes pv where pv."postId" = posts.id and pv.vote = 'like') ${comparison} ${value}`;
  }
};

export const numericFilterPredicate =
  (filter: NumericSearchFilter): PostPredicate =>
  () =>
    numericFilterExpression(filter);

export const textPredicate = (text: string): PostPredicate => {
  const pattern = `%${escapeLikePattern(text)}%`;
  return (eb) =>
    eb.or([
      eb("posts.title", "ilike", pattern),
      eb("posts.description", "ilike", pattern),
    ]);
};

export const seriesTitlePredicate =
  (seriesTitle: string): PostPredicate =>
  () =>
    sql<boolean>`lower("animeTitle") = lower(${seriesTitle})`;

const taggedPostIds =
  (names: readonly string[]) => (nestedEb: ExpressionBuilder<DB, "posts">) =>
    nestedEb
      .selectFrom("post_tags")
      .innerJoin("tags", "tags.id", "post_tags.tagId")
      .where("tags.name", "in", [...names])
      .select("post_tags.postId");

export const includedTagsPredicate =
  (names: readonly string[]): PostPredicate =>
  (eb) =>
    eb("posts.id", "in", taggedPostIds(names));

export const excludedTagsPredicate =
  (names: readonly string[]): PostPredicate =>
  (eb) =>
    eb("posts.id", "not in", taggedPostIds(names));

// oxlint-disable effecttsgo/global-date -- calendar-day boundaries use the server's local timezone so "today"/"this week" match user expectations; Effect DateTime has no local-midnight equivalent
const computeStartDate = (dateRange: "today" | "week" | "month", now: Date) => {
  const start = new Date(now);
  if (dateRange === "today") {
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (dateRange === "week") {
    start.setDate(start.getDate() - 7);
    return start;
  }
  start.setMonth(start.getMonth() - 1);
  return start;
};
// oxlint-enable effecttsgo/global-date

export const dateRangePredicate = ({
  dateRange,
  now,
}: {
  dateRange: "today" | "week" | "month";
  now: Date;
}): PostPredicate => {
  const start = computeStartDate(dateRange, now);
  return (eb) => eb("posts.createdAt", ">=", start);
};

// These windows are deliberately explicit and are mirrored in
// `posts/discovery.ts`, so every experiment can explain its ranking inputs to
// the user. Points are intentionally not part of any quality or rank score.
// oxlint-disable effecttsgo/global-date -- discovery windows are server-local calendar-relative instants, matching the existing feed date filters
const computeDaysAgo = (days: number, now: Date) =>
  new Date(now.valueOf() - days * DAY_MS);
// oxlint-enable effecttsgo/global-date

const voteCountExpression = (vote: "like" | "dislike", createdAfter?: Date) =>
  createdAfter === undefined
    ? sql<number>`(select count(*) from post_votes pv where pv."postId" = posts.id and pv.vote = ${vote})`
    : sql<number>`(select count(*) from post_votes pv where pv."postId" = posts.id and pv.vote = ${vote} and pv."createdAt" >= ${createdAfter})`;

export const rankingExpressions = (now: Date) => {
  const recentVotingStart = computeDaysAgo(7, now);
  return {
    allTimeLikes: voteCountExpression("like"),
    recentDislikes: voteCountExpression("dislike", recentVotingStart),
    recentLikes: voteCountExpression("like", recentVotingStart),
  };
};

const createdAfterPredicate =
  (createdAfter: Date): PostPredicate =>
  (eb) =>
    eb("posts.createdAt", ">=", createdAfter);

const followedTagPredicate =
  (userId: string): PostPredicate =>
  (eb) =>
    eb("posts.id", "in", (nestedEb) =>
      nestedEb
        .selectFrom("post_tags")
        .where("post_tags.tagId", "in", (eb2) =>
          eb2
            .selectFrom("tag_follows")
            .where("tag_follows.userId", "=", userId)
            .select("tag_follows.tagId"),
        )
        .select("post_tags.postId"),
    );

const falsePredicate: PostPredicate = () => sql<boolean>`false`;

export const viewScope = ({
  now,
  view,
  viewerId,
}: {
  now: Date;
  view: DiscoveryView;
  viewerId: string | null;
}): PostScope => {
  const { allTimeLikes, recentDislikes, recentLikes } = rankingExpressions(now);
  switch (view) {
    case "followed-tags":
      // Discovery views are opt-in and public by default. An anonymous
      // visitor sees an empty personal feed instead of a server error.
      if (viewerId === null) {
        return [falsePredicate];
      }
      return [
        followedTagPredicate(viewerId),
        createdAfterPredicate(computeDaysAgo(FOLLOWED_TAGS_WINDOW_DAYS, now)),
      ];
    case "most-liked":
      return [() => sql<boolean>`${recentLikes} > 0`];
    case "random-study":
      return [];
    case "trending":
      return [() => sql<boolean>`${recentLikes} - ${recentDislikes} > 0`];
    case "under-seen":
      return [
        createdAfterPredicate(computeDaysAgo(UNDER_SEEN_WINDOW_DAYS, now)),
        () => sql<boolean>`${allTimeLikes} <= ${UNDER_SEEN_MAX_LIKES}`,
      ];
    case "chronological":
      return [];
  }
};
