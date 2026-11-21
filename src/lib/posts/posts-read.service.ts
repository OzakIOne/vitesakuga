import { Clock, Context, Effect, Layer, Option, Schema } from "effect";
import { sql } from "kysely";
import { postsSelectSchema } from "src/lib/db/schema";

import { SessionFetchError, SessionService } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import type { SqlError } from "../db/effect-kysely";
import type { postSourceSchema, PostWithVotes } from "../db/schema";
import { toIsoTimestamp } from "../db/schema/timestamp";
import { parse } from "../effect/schema.utils";
import { PostNotFoundError, RowParseError } from "../errors";
import { asPostId, PostId } from "../ids";
import type { PaginationMeta } from "../pagination/pagination";
import type { mapPopularTags } from "../tags/tags.utils";
import { mergeVoteCounts } from "../votes/votes.utils";
import {
  dateRangePredicate,
  excludedTagsPredicate,
  fetchPostPage,
  includedTagsPredicate,
  numericFilterPredicate,
  rankingExpressions,
  seriesTitlePredicate,
  textPredicate,
  viewScope,
  type PostOrdering,
  type PostScope,
} from "./post-page-query";
import {
  postByTagSchema,
  randomPostSchema,
  RESERVED_TAG_NAMES,
  seriesHubSchema,
  VideoMetadataSchema,
  type DiscoveryView,
  type SearchPostsRequest,
} from "./posts.schema";
import { parseSearchQuery } from "./search-filters";

const randomOrderExpression = (seed: number) =>
  sql<string>`md5(concat(posts.id, cast(${seed} as text)))`;

const viewOrdering = ({
  now,
  randomSeed,
  sortBy,
  view,
}: {
  now: Date;
  randomSeed: number;
  sortBy: SearchPostsRequest["params"]["sortBy"];
  view: DiscoveryView;
}): PostOrdering => {
  const { allTimeLikes, recentDislikes, recentLikes } = rankingExpressions(now);
  switch (view) {
    case "most-liked":
      return (query) =>
        query
          .orderBy(recentLikes, "desc")
          .orderBy("posts.createdAt", "desc")
          .orderBy("posts.id", "desc");
    case "random-study":
      return (query) =>
        query
          .orderBy(randomOrderExpression(randomSeed), "asc")
          .orderBy("posts.id", "asc");
    case "trending":
      return (query) =>
        query
          .orderBy(sql<number>`${recentLikes} - ${recentDislikes}`, "desc")
          .orderBy(recentLikes, "desc")
          .orderBy("posts.createdAt", "desc")
          .orderBy("posts.id", "desc");
    case "under-seen":
      return (query) =>
        query
          .orderBy(allTimeLikes, "asc")
          .orderBy("posts.createdAt", "desc")
          .orderBy("posts.id", "desc");
    case "followed-tags":
      return (query) =>
        query.orderBy("posts.createdAt", "desc").orderBy("posts.id", "desc");
    case "chronological":
      return (query) =>
        query
          .orderBy("posts.createdAt", sortBy === "oldest" ? "asc" : "desc")
          .orderBy("posts.id", sortBy === "oldest" ? "asc" : "desc");
  }
};

export type PostsSearchResult = {
  readonly data: readonly PostWithVotes[];
  meta: {
    pagination: PaginationMeta;
    popularTags: ReturnType<typeof mapPopularTags>;
  };
};

export type SeriesHubResult = {
  readonly posts: readonly PostWithVotes[];
  readonly title: string;
};

export type PostDetailResult = {
  post: {
    animeTitle: string | null;
    chapterNumber: number | null;
    description: string;
    /** ISO timestamp string — `Date` does not survive the JSON server-function transport. */
    createdAt: string;
    episodeNumber: number | null;
    id: PostId;
    relatedPostId: PostId | null;
    seasonNumber: number | null;
    source: string | null;
    sourceType: Schema.Schema.Type<typeof postSourceSchema> | null;
    thumbnailKey: string;
    title: string;
    videoKey: string | null;
    videoMetadata: Schema.Schema.Type<typeof VideoMetadataSchema>;
    version: number;
    volumeNumber: number | null;
  };
  images: string[];
  relatedPost: Schema.Codec.Encoded<typeof postsSelectSchema> | null;
  tags: { id: number; name: string }[];
  user: {
    id: string;
    image: string | null;
    name: string;
  };
};

export class PostsReadService extends Context.Service<
  PostsReadService,
  {
    readonly search: (
      data: SearchPostsRequest,
    ) => Effect.Effect<
      PostsSearchResult,
      SqlError | RowParseError | SessionFetchError,
      SessionService
    >;
    readonly fetchRandomPost: (
      data: Schema.Schema.Type<typeof randomPostSchema>,
    ) => Effect.Effect<PostId | null, SqlError>;
    readonly fetchSeriesHub: (
      data: Schema.Schema.Type<typeof seriesHubSchema>,
    ) => Effect.Effect<SeriesHubResult, SqlError | RowParseError>;
    readonly fetchDetail: (
      postId: number,
    ) => Effect.Effect<PostDetailResult, SqlError | PostNotFoundError>;
    readonly fetchDetailVersion: (
      postId: number,
    ) => Effect.Effect<number, SqlError | PostNotFoundError>;
    readonly getByTag: (
      data: Schema.Schema.Type<typeof postByTagSchema>,
    ) => Effect.Effect<PostsSearchResult, SqlError | RowParseError>;
  }
>()("PostsReadService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;

    const search = Effect.fn("PostsReadService.search")(function* (
      data: SearchPostsRequest,
    ) {
      const { includePopularTags } = data;
      const {
        dateRange,
        page,
        randomSeed = 0,
        seriesTitle,
        sortBy,
        tags,
        view = "chronological",
      } = data.params;
      const parsedSearch = parseSearchQuery(data.params.q);
      const { excludedTags, filters, text } = parsedSearch;
      const now = new Date(yield* Clock.currentTimeMillis);
      const sessions = yield* SessionService;
      const viewer =
        view === "followed-tags" ? yield* sessions.getUser() : null;

      const scope: PostScope = [
        ...viewScope({ now, view, viewerId: viewer?.id ?? null }),
        ...(text ? [textPredicate(text)] : []),
        ...(seriesTitle ? [seriesTitlePredicate(seriesTitle)] : []),
        ...(tags.length > 0 ? [includedTagsPredicate(tags)] : []),
        ...(excludedTags.length > 0
          ? [excludedTagsPredicate(excludedTags)]
          : []),
        ...(view === "chronological" && dateRange !== "all"
          ? [dateRangePredicate({ dateRange, now })]
          : []),
        ...filters.map(numericFilterPredicate),
      ];

      return yield* fetchPostPage(db, {
        includePopularTags: includePopularTags && view === "chronological",
        ordering: viewOrdering({ now, randomSeed, sortBy, view }),
        page,
        scope,
      });
    });

    const fetchRandomPost = Effect.fn("PostsReadService.fetchRandomPost")(
      function* (data: Schema.Schema.Type<typeof randomPostSchema>) {
        const post = yield* db.executeTakeFirstOption(
          db
            .selectFrom("posts")
            .select("posts.id")
            .orderBy(randomOrderExpression(data.randomSeed), "asc")
            .orderBy("posts.id", "asc")
            .limit(1),
        );

        return Option.match(post, {
          onNone: () => null,
          // SAFETY: posts.id is the table's primary key.
          onSome: (row) => asPostId(row.id),
        });
      },
    );

    const fetchSeriesHub = Effect.fn("PostsReadService.fetchSeriesHub")(
      function* (data: Schema.Schema.Type<typeof seriesHubSchema>) {
        const seriesTitle = data.seriesTitle.trim();
        const items = yield* db.execute(
          db
            .selectFrom("posts")
            .selectAll("posts")
            // The title from a post link is normally an exact match, while the
            // case-insensitive comparison keeps manually shared URLs useful.
            .where(sql<boolean>`lower("animeTitle") = lower(${seriesTitle})`)
            .orderBy("posts.createdAt", "asc")
            .orderBy("posts.id", "asc"),
        );

        const parsed = yield* Effect.try({
          try: () => parse(Schema.Array(postsSelectSchema))(items),
          catch: (error) =>
            new RowParseError({
              message: `Error processing series results: ${String(error)}`,
            }),
        });
        const posts = yield* mergeVoteCounts(db, parsed);

        return {
          posts,
          title: parsed[0]?.animeTitle ?? seriesTitle,
        };
      },
    );

    const fetchDetail = Effect.fn("PostsReadService.fetchDetail")(function* (
      rawPostId: number,
    ) {
      const postId = asPostId(rawPostId);
      const postOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("posts")
          .innerJoin("user", "user.id", "posts.userId")
          .select([
            "posts.id",
            "posts.title",
            "posts.description",
            "posts.createdAt",
            "posts.videoKey",
            "posts.source",
            "posts.relatedPostId",
            "posts.videoMetadata",
            "posts.animeTitle",
            "posts.seasonNumber",
            "posts.episodeNumber",
            "posts.chapterNumber",
            "posts.volumeNumber",
            "posts.sourceType",
            "posts.thumbnailKey",
            "posts.version",
            "user.id as userId",
            "user.name as userName",
            "user.image as userImage",
          ])
          .where("posts.id", "=", postId),
      );

      const postWithUser = yield* Option.match(postOption, {
        onNone: () =>
          Effect.fail(
            new PostNotFoundError({
              message: `Post ${postId} not found`,
              postId,
            }),
          ),
        onSome: (value) => Effect.succeed(value),
      });

      const tags = yield* db.execute(
        db
          .selectFrom("post_tags")
          .innerJoin("tags", "tags.id", "post_tags.tagId")
          .select(["tags.id", "tags.name"])
          .where("post_tags.postId", "=", postWithUser.id)
          .where("tags.name", "not in", [...RESERVED_TAG_NAMES])
          .orderBy("tags.name", "asc"),
      );

      const imageRows = yield* db.execute(
        db
          .selectFrom("post_images")
          .select(["post_images.position", "post_images.storageKey"])
          .where("postId", "=", postWithUser.id)
          .orderBy("position", "asc"),
      );

      // SAFETY: relatedPostId is a posts.id foreign key column; the row value
      // is coerced to the branded type the FK relationship guarantees.
      const relatedPostOption = postWithUser.relatedPostId
        ? yield* db.executeTakeFirstOption(
            db
              .selectFrom("posts")
              .selectAll()
              .where("id", "=", asPostId(postWithUser.relatedPostId as number)),
          )
        : Option.none();

      const relatedPost = Option.match(relatedPostOption, {
        onNone: () => null,
        onSome: (row) =>
          Schema.encodeSync(postsSelectSchema)(parse(postsSelectSchema)(row)),
      });

      return {
        post: {
          animeTitle: postWithUser.animeTitle,
          description: postWithUser.description,
          createdAt: toIsoTimestamp(postWithUser.createdAt),
          // SAFETY: posts.id is the table's primary key.
          id: asPostId(postWithUser.id),
          // SAFETY: relatedPostId is a posts.id FK column; the row value
          // satisfies the PostId contract by construction.
          relatedPostId: postWithUser.relatedPostId
            ? asPostId(postWithUser.relatedPostId as number)
            : null,
          source: postWithUser.source,
          thumbnailKey: postWithUser.thumbnailKey,
          title: postWithUser.title,
          version: postWithUser.version,
          videoKey: postWithUser.videoKey,
          videoMetadata: parse(VideoMetadataSchema)(postWithUser.videoMetadata),
          seasonNumber: postWithUser.seasonNumber,
          episodeNumber: postWithUser.episodeNumber,
          chapterNumber: postWithUser.chapterNumber,
          volumeNumber: postWithUser.volumeNumber,
          sourceType: postWithUser.sourceType,
        },
        images: imageRows.map((row) => row.storageKey),
        relatedPost,
        tags,
        user: {
          id: postWithUser.userId,
          image: postWithUser.userImage,
          name: postWithUser.userName,
        },
      };
    });

    const getByTag = Effect.fn("PostsReadService.getByTag")(function* (
      data: Schema.Schema.Type<typeof postByTagSchema>,
    ) {
      const { tag: tagName, page } = data;

      return yield* fetchPostPage(db, {
        includePopularTags: true,
        ordering: (query) => query.orderBy("posts.createdAt", "desc"),
        page,
        scope: [includedTagsPredicate([tagName])],
      });
    });

    const fetchDetailVersion = Effect.fn("PostsReadService.fetchDetailVersion")(
      function* (rawPostId: number) {
        const postId = asPostId(rawPostId);
        const row = yield* db.executeTakeFirstOption(
          db
            .selectFrom("posts")
            .select(["id", "version"])
            .where("id", "=", postId),
        );
        if (Option.isNone(row)) {
          return yield* new PostNotFoundError({
            message: `Post ${postId} not found`,
            postId,
          });
        }
        return row.value.version;
      },
    );

    return {
      fetchDetail,
      fetchDetailVersion,
      fetchRandomPost,
      fetchSeriesHub,
      getByTag,
      search,
    };
  }),
}) {}

export const PostsReadServiceLive = Layer.effect(
  PostsReadService,
  PostsReadService.make,
);
