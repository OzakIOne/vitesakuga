import { createServerFn } from "@tanstack/react-start";
import {
  Clock,
  Context,
  DateTime,
  Effect,
  Exit,
  Layer,
  Option,
  Schema,
} from "effect";
import {
  sql,
  type Expression,
  type ExpressionBuilder,
  type SqlBool,
} from "kysely";
import { postsSelectSchema } from "src/lib/db/schema";

import { ensureOwnedOrStaff } from "../auth/ownership";
import { getUserRole } from "../auth/policy";
import { SessionFetchError, SessionService } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import type { DB } from "../db/kysely";
import type {
  MediaOperationResult,
  postSourceSchema,
  PostWithVotes,
} from "../db/schema";
import { toIsoTimestamp } from "../db/schema/timestamp";
import {
  SqlError,
  SqlNoFirstResult,
  type EffectTransition,
} from "../effect/effect.utils";
import { parse, parseStrict } from "../effect/schema.utils";
import {
  ForbiddenError,
  PostNotFoundError,
  RowParseError,
  UnauthorizedError,
  ValidationError,
} from "../errors";
import { asPostId, PostId } from "../ids";
import {
  FingerprintInputError,
  operationRequestFingerprint,
} from "../lifecycle/fingerprint";
import {
  finishOperationInTransaction,
  LifecycleService,
  updatePostWithVersionInTransaction,
  LifecycleServiceLive,
  type LifecycleError,
} from "../lifecycle/lifecycle.service";
import {
  computePagination,
  type PaginationMeta,
} from "../pagination/pagination";
import { PointsService, PointsServiceLive } from "../points/points.service";
import { baseLayerFactories, createHandler } from "../server-fn.handler";
import { imageContentType, videoContentType } from "../storage/content-type";
import {
  imageObjectKey,
  pendingVideoObjectKey,
  pendingVideoPrefix,
  thumbnailObjectKey,
  videoObjectKey,
} from "../storage/keys";
import { StorageError, StorageModule } from "../storage/storage.module";
import { isUploadedVideoValid } from "../storage/upload-policy";
import { fetchPopularTagsForPosts, mapPopularTags } from "../tags/tags.utils";
import { mergeVoteCounts } from "../votes/votes.utils";
import {
  assertSupportedImageFile,
  assertThumbnailIsJpeg,
} from "./file-validation";
import {
  createVideoUploadUrlSchema,
  FormFileUploadSchema,
  MAX_VIDEO_SIZE_BYTES,
  postByTagSchema,
  RESERVED_TAG_NAMES,
  randomPostSchema,
  searchPostsBaseSchema,
  seriesHubSchema,
  type PostsSearchInput,
  updatePostInputSchema,
  VideoMetadataSchema,
} from "./posts.schema";
import { parseSearchQuery, type NumericSearchFilter } from "./search-filters";
import { escapeLikePattern } from "./search-pattern";

const PAGE_SIZE = 30;
const DAY_MS = 86_400_000;
const FOLLOWED_TAGS_WINDOW_DAYS = 14;
const UNDER_SEEN_WINDOW_DAYS = 30;
const UNDER_SEEN_MAX_LIKES = 5;

const fileDigest = (file: File): Effect.Effect<string, FingerprintInputError> =>
  Effect.tryPromise({
    try: async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return `sha256:${Array.from(new Uint8Array(digest), (value) =>
        value.toString(16).padStart(2, "0"),
      ).join("")}`;
    },
    catch: (cause) =>
      new FingerprintInputError({
        message: `Failed to fingerprint media file: ${String(cause)}`,
      }),
  });

type PostUpdateChanges = {
  description: string;
  relatedPostId?: number | null;
  source?: string | null;
  title: string;
};

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

// oxlint-disable effecttsgo/global-date -- calendar-day boundaries use the server's local timezone so "today"/"this week" match user expectations; Effect DateTime has no local-midnight equivalent
const computeStartDate = (dateRange: "today" | "week" | "month", now: Date) => {
  if (dateRange === "today") {
    return new Date(now.setHours(0, 0, 0, 0));
  }
  if (dateRange === "week") {
    return new Date(now.setDate(now.getDate() - 7));
  }
  return new Date(now.setMonth(now.getMonth() - 1));
};
// oxlint-enable effecttsgo/global-date

// These windows are deliberately explicit and are mirrored in
// `posts/discovery.ts`, so every experiment can explain its ranking inputs to
// the user. Points are intentionally not part of any quality or rank score.
// oxlint-disable-next-line effecttsgo/global-date -- discovery windows are server-local calendar-relative instants, matching the existing feed date filters
const computeDaysAgo = (days: number, now: Date) =>
  new Date(now.valueOf() - days * DAY_MS);

const voteCountExpression = (vote: "like" | "dislike", createdAfter?: Date) =>
  createdAfter === undefined
    ? sql<number>`(select count(*) from post_votes pv where pv."postId" = posts.id and pv.vote = ${vote})`
    : sql<number>`(select count(*) from post_votes pv where pv."postId" = posts.id and pv.vote = ${vote} and pv."createdAt" >= ${createdAfter})`;

const randomOrderExpression = (seed: number) =>
  sql<string>`md5(concat(posts.id, cast(${seed} as text)))`;

type PostsSearchResult = {
  readonly data: readonly PostWithVotes[];
  meta: {
    pagination: PaginationMeta;
    popularTags: ReturnType<typeof mapPopularTags>;
  };
};

type SeriesHubResult = {
  readonly posts: readonly PostWithVotes[];
  readonly title: string;
};

type PostDetailResult = {
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

export class PostsService extends Context.Service<
  PostsService,
  {
    readonly search: (
      data: PostsSearchInput,
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
      postId: PostId,
    ) => Effect.Effect<PostDetailResult, SqlError | PostNotFoundError>;
    readonly fetchDetailVersion: (
      postId: PostId,
    ) => Effect.Effect<number, SqlError | PostNotFoundError>;
    readonly upload: (
      data: Schema.Schema.Type<typeof FormFileUploadSchema>,
    ) => Effect.Effect<
      Schema.Schema.Type<typeof postsSelectSchema>,
      | SqlError
      | SqlNoFirstResult
      | StorageError
      | UnauthorizedError
      | SessionFetchError
      | ValidationError
      | RowParseError
      | FingerprintInputError
      | LifecycleError,
      SessionService
    >;
    readonly createVideoUploadUrl: (
      data: Schema.Schema.Type<typeof createVideoUploadUrlSchema>,
    ) => Effect.Effect<
      {
        readonly contentType: string;
        readonly key: string;
        readonly requiredHeaders: Readonly<Record<string, string>>;
        readonly url: string;
      },
      StorageError | UnauthorizedError | SessionFetchError,
      SessionService
    >;
    readonly update: (
      data: Schema.Schema.Type<typeof updatePostInputSchema>,
    ) => Effect.Effect<
      Schema.Schema.Type<typeof postsSelectSchema>,
      | UnauthorizedError
      | ForbiddenError
      | PostNotFoundError
      | SessionFetchError
      | SqlError
      | SqlNoFirstResult
      | RowParseError
      | ValidationError
      | FingerprintInputError
      | import("../lifecycle/lifecycle.service").LifecycleError,
      SessionService
    >;
    readonly getByTag: (
      data: Schema.Schema.Type<typeof postByTagSchema>,
    ) => Effect.Effect<PostsSearchResult, SqlError | RowParseError>;
  }
>()("PostsService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;
    const storage = yield* StorageModule;
    const lifecycle = yield* LifecycleService;
    const points = yield* PointsService;

    const validateRelatedPost = Effect.fn("PostsService.validateRelatedPost")(
      function* (args: {
        readonly postId?: PostId | undefined;
        readonly relatedPostId?: PostId | undefined;
      }) {
        if (args.relatedPostId === undefined) {
          return;
        }

        if (args.postId === args.relatedPostId) {
          return yield* Effect.fail(
            new ValidationError({
              message: "A post cannot be related to itself",
            }),
          );
        }

        const relatedPost = yield* db.executeTakeFirstOption(
          db
            .selectFrom("posts")
            .select("id")
            .where("id", "=", args.relatedPostId),
        );
        if (Option.isNone(relatedPost)) {
          return yield* Effect.fail(
            new ValidationError({
              message: `Related post ${args.relatedPostId} not found`,
            }),
          );
        }
      },
    );

    const search = Effect.fn("PostsService.search")(function* (
      data: PostsSearchInput,
    ) {
      const {
        dateRange,
        page,
        randomSeed = 0,
        seriesTitle,
        sortBy,
        tags,
        view = "chronological",
      } = data;
      const parsedSearch = parseSearchQuery(data.q);
      const { excludedTags, text: q } = parsedSearch;
      const now = new Date(yield* Clock.currentTimeMillis);
      const sessions = yield* SessionService;

      let query = db.selectFrom("posts").selectAll("posts");

      if (view === "followed-tags") {
        const user = yield* sessions.getUser();
        if (user === null) {
          // Discovery views are opt-in and public by default. An anonymous
          // visitor sees an empty personal feed instead of a server error.
          query = query.where(sql<boolean>`false`);
        } else {
          query = query.where("posts.id", "in", (eb) =>
            eb
              .selectFrom("post_tags")
              .where("post_tags.tagId", "in", (eb2) =>
                eb2
                  .selectFrom("tag_follows")
                  .where("tag_follows.userId", "=", user.id)
                  .select("tag_follows.tagId"),
              )
              .select("post_tags.postId"),
          );
        }
      }

      if (q) {
        const pattern = `%${escapeLikePattern(q)}%`;
        query = query.where((eb) =>
          eb("posts.title", "ilike", pattern).or(
            "posts.description",
            "ilike",
            pattern,
          ),
        );
      }

      if (seriesTitle) {
        query = query.where(
          sql<boolean>`lower("animeTitle") = lower(${seriesTitle})`,
        );
      }

      if (tags.length > 0) {
        query = query.where("posts.id", "in", (eb) =>
          eb
            .selectFrom("post_tags")
            .innerJoin("tags", "tags.id", "post_tags.tagId")
            .where("tags.name", "in", tags)
            .select("post_tags.postId"),
        );
      }

      if (excludedTags.length > 0) {
        query = query.where("posts.id", "not in", (eb) =>
          eb
            .selectFrom("post_tags")
            .innerJoin("tags", "tags.id", "post_tags.tagId")
            .where("tags.name", "in", excludedTags)
            .select("post_tags.postId"),
        );
      }

      if (view === "chronological" && dateRange !== "all") {
        query = query.where(
          "posts.createdAt",
          ">=",
          computeStartDate(dateRange, now),
        );
      }

      for (const filter of parsedSearch.filters) {
        query = query.where(numericFilterExpression(filter));
      }

      const recentVotingStart = computeDaysAgo(7, now);
      const recentLikes = voteCountExpression("like", recentVotingStart);
      const recentDislikes = voteCountExpression("dislike", recentVotingStart);
      const allTimeLikes = voteCountExpression("like");

      switch (view) {
        case "followed-tags":
          query = query.where(
            "posts.createdAt",
            ">=",
            computeDaysAgo(FOLLOWED_TAGS_WINDOW_DAYS, now),
          );
          break;
        case "most-liked":
          query = query.where(sql<boolean>`${recentLikes} > 0`);
          break;
        case "random-study":
          break;
        case "trending":
          query = query.where(
            sql<boolean>`${recentLikes} - ${recentDislikes} > 0`,
          );
          break;
        case "under-seen":
          query = query
            .where(
              "posts.createdAt",
              ">=",
              computeDaysAgo(UNDER_SEEN_WINDOW_DAYS, now),
            )
            .where(sql<boolean>`${allTimeLikes} <= ${UNDER_SEEN_MAX_LIKES}`);
          break;
        case "chronological":
          break;
      }

      const countQuery = query
        .clearSelect()
        .select((eb) => eb.fn.countAll().as("count"));
      const countResult = yield* db.executeTakeFirstOrUndefined(countQuery);
      const totalCount = Number(countResult?.count ?? 0);

      const pagination = computePagination(totalCount, {
        page,
        pageSize: PAGE_SIZE,
      });

      switch (view) {
        case "most-liked":
          query = query
            .orderBy(recentLikes, "desc")
            .orderBy("posts.createdAt", "desc")
            .orderBy("posts.id", "desc");
          break;
        case "random-study":
          query = query
            .orderBy(randomOrderExpression(randomSeed), "asc")
            .orderBy("posts.id", "asc");
          break;
        case "trending":
          query = query
            .orderBy(sql<number>`${recentLikes} - ${recentDislikes}`, "desc")
            .orderBy(recentLikes, "desc")
            .orderBy("posts.createdAt", "desc")
            .orderBy("posts.id", "desc");
          break;
        case "under-seen":
          query = query
            .orderBy(allTimeLikes, "asc")
            .orderBy("posts.createdAt", "desc")
            .orderBy("posts.id", "desc");
          break;
        case "followed-tags":
          query = query
            .orderBy("posts.createdAt", "desc")
            .orderBy("posts.id", "desc");
          break;
        case "chronological":
          query = query
            .orderBy("posts.createdAt", sortBy === "oldest" ? "asc" : "desc")
            .orderBy("posts.id", sortBy === "oldest" ? "asc" : "desc");
          break;
      }

      const items = yield* db.execute(
        query.offset(pagination.offset).limit(PAGE_SIZE),
      );

      const parsed = yield* Effect.try({
        try: () => parse(Schema.Array(postsSelectSchema))(items),
        catch: (error) =>
          new RowParseError({
            message: `Error processing search results: ${String(error)}`,
          }),
      });

      const parsedWithVotes = yield* mergeVoteCounts(db, parsed);

      const popularTagsPredicates: ((
        eb: ExpressionBuilder<DB, "posts">,
      ) => Expression<SqlBool>)[] = [];
      if (q) {
        const pattern = `%${escapeLikePattern(q)}%`;
        popularTagsPredicates.push((eb) =>
          eb.or([
            eb("posts.title", "ilike", pattern),
            eb("posts.description", "ilike", pattern),
          ]),
        );
      }

      if (seriesTitle) {
        popularTagsPredicates.push(
          () => sql<boolean>`lower("animeTitle") = lower(${seriesTitle})`,
        );
      }

      if (tags.length > 0) {
        popularTagsPredicates.push((eb) =>
          eb("posts.id", "in", (nestedEb) =>
            nestedEb
              .selectFrom("post_tags")
              .innerJoin("tags", "tags.id", "post_tags.tagId")
              .where("tags.name", "in", tags)
              .select("post_tags.postId"),
          ),
        );
      }

      if (dateRange !== "all") {
        popularTagsPredicates.push((eb) =>
          eb("posts.createdAt", ">=", computeStartDate(dateRange, now)),
        );
      }

      if (excludedTags.length > 0) {
        popularTagsPredicates.push((eb) =>
          eb("posts.id", "not in", (nestedEb) =>
            nestedEb
              .selectFrom("post_tags")
              .innerJoin("tags", "tags.id", "post_tags.tagId")
              .where("tags.name", "in", excludedTags)
              .select("post_tags.postId"),
          ),
        );
      }

      for (const filter of parsedSearch.filters) {
        popularTagsPredicates.push(() => numericFilterExpression(filter));
      }

      const popularTags =
        view === "chronological"
          ? yield* fetchPopularTagsForPosts(db, popularTagsPredicates)
          : [];

      return {
        data: parsedWithVotes,
        meta: {
          pagination,
          popularTags,
        },
      };
    });

    const fetchRandomPost = Effect.fn("PostsService.fetchRandomPost")(
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

    const fetchSeriesHub = Effect.fn("PostsService.fetchSeriesHub")(function* (
      data: Schema.Schema.Type<typeof seriesHubSchema>,
    ) {
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
    });

    const fetchDetail = Effect.fn("PostsService.fetchDetail")(function* (
      postId: PostId,
    ) {
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
          // Reserved media-kind tags are managed by the server; users never
          // see or edit them in the tag UI.
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
        // Full posts row: run it through the select schema so its identity
        // fields come out branded, then re-encode so `createdAt` leaves as
        // an ISO string (the wire format `postsSelectSchema` Encoded promises).
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

    const upload = Effect.fn("PostsService.upload")(function* (
      data: Schema.Schema.Type<typeof FormFileUploadSchema>,
    ) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireUser(
        "You must be logged in to upload a post",
      );

      const userId = user.id;
      const operationKey = data.operationKey ?? crypto.randomUUID();
      const fileDigests = [
        ...(data.images === undefined
          ? []
          : yield* Effect.forEach(data.images, (file, index) =>
              fileDigest(file).pipe(
                Effect.map((digest) => ({ digest, slot: `image:${index}` })),
              ),
            )),
        ...(data.thumbnail === undefined
          ? []
          : [
              {
                digest: yield* fileDigest(data.thumbnail),
                slot: "thumbnail",
              },
            ]),
      ];
      const requestFingerprint = yield* operationRequestFingerprint({
        fileDigests,
        operationKind: "post-create",
        payload: {
          description: data.description,
          relatedPostId: data.relatedPostId ?? null,
          source: data.source ?? null,
          tags: data.tags.map((tag) => ({
            id: tag.id ?? null,
            name: tag.name,
          })),
          title: data.title,
          videoKey: data.videoKey ?? null,
        },
        userId,
      });
      const claim = yield* lifecycle.claimOperation({
        kind: "post-create",
        operationKey,
        requestFingerprint,
        userId,
      });
      if (claim.outcome === "replayed") {
        if (claim.result?.postId === undefined) {
          return yield* new ValidationError({
            message: "Completed upload has no post result",
          });
        }
        const replayed = yield* db.executeTakeFirstOrError(
          db
            .selectFrom("posts")
            .selectAll()
            .where("id", "=", claim.result.postId),
        );
        return yield* Effect.try({
          try: () => parse(postsSelectSchema)(replayed),
          catch: (error) =>
            new RowParseError({
              message: "There was an error processing the replay result",
              cause: error,
            }),
        });
      }

      const claimFence = claim.fence;

      const {
        title,
        description,
        source,
        relatedPostId,
        tags,
        videoMetadata,
        videoKey,
      } = data;

      yield* validateRelatedPost({ relatedPostId });

      yield* Effect.logInfo("Upload started").pipe(
        Effect.annotateLogs({
          mediaKind: videoKey === undefined ? "image" : "video",
          title,
          userId,
        }),
      );

      let finalVideoKey: string | null = null;
      let videoObserved: {
        contentLength: number;
        contentType: string;
        fingerprint: string;
        etag: string;
      } | null = null;

      // Only keys from the caller's own deterministic staging namespace are
      // acceptable. The final object identity is derived from operationId.
      if (videoKey !== undefined) {
        if (!videoKey.startsWith(pendingVideoPrefix(userId))) {
          return yield* Effect.fail(
            new ValidationError({ message: "Invalid video upload key" }),
          );
        }

        const ext = videoKey.split(".").pop() ?? "";
        const expectedContentType = videoContentType(ext);
        const head = yield* storage.headFile(videoKey).pipe(
          Effect.mapError(
            (error) =>
              new ValidationError({
                cause: error,
                message: `Video upload could not be verified: ${error.message}`,
              }),
          ),
        );

        if (!isUploadedVideoValid(head, expectedContentType)) {
          yield* storage.deleteFile(videoKey).pipe(Effect.ignore);
          return yield* Effect.fail(
            new ValidationError({
              message: `Video upload is invalid: expected ${expectedContentType}, at most ${MAX_VIDEO_SIZE_BYTES / (1024 * 1024)} MB`,
            }),
          );
        }

        const stagingEtag = head.etag;
        if (stagingEtag === null) {
          return yield* Effect.fail(
            new ValidationError({ message: "Video upload has no stable ETag" }),
          );
        }
        const extension = videoKey.split(".").pop() ?? "mp4";
        finalVideoKey = videoObjectKey(claim.operationId, extension);
        videoObserved = {
          contentLength: head.contentLength,
          contentType: head.contentType,
          fingerprint: `etag:${stagingEtag}`,
          etag: stagingEtag,
        };
      }

      const uploadedKeys: string[] = [];
      function* prepareAndReady(
        key: string,
        kind: "video" | "image" | "thumbnail",
        contentLength: number,
        contentType: string,
        fingerprint: string,
      ) {
        const reservation = yield* lifecycle.reserveObject({
          contentLength,
          contentType,
          fence: claimFence,
          fingerprint,
          key,
          kind,
          operationId: claim.operationId,
          userId,
        });
        yield* lifecycle.markPreparing({
          key,
          fence: reservation.object.fence,
          operationId: claim.operationId,
        });
        return reservation.object.fence;
      }

      const outcome = yield* Effect.gen(function* () {
        let thumbnailKey: string;
        const imageKeys: string[] = [];

        if (finalVideoKey !== null && videoObserved !== null) {
          const fence = yield* prepareAndReady(
            finalVideoKey,
            "video",
            videoObserved.contentLength,
            videoObserved.contentType,
            videoObserved.fingerprint,
          );
          const copied = yield* storage.copyVideoIfMatch(
            // SAFETY: videoKey is defined in this branch because the enclosing condition checks videoKey !== undefined.
            videoKey as string,
            videoObserved.etag,
            finalVideoKey,
          );
          uploadedKeys.push(copied.key);
          yield* lifecycle.markReady({
            key: finalVideoKey,
            fence,
            operationId: claim.operationId,
            observed: {
              contentLength: videoObserved.contentLength,
              contentType: videoObserved.contentType,
              fingerprint: videoObserved.fingerprint,
            },
          });
        }

        if (data.images !== undefined && data.images.length > 0) {
          for (const [index, image] of data.images.entries()) {
            const key = imageObjectKey(
              claim.operationId,
              index,
              image.name.split(".").pop() ?? "png",
            );
            const extension = image.name.split(".").pop() ?? "png";
            const contentType = imageContentType(extension);
            const fingerprint = yield* fileDigest(image);
            const fence = yield* prepareAndReady(
              key,
              "image",
              image.size,
              contentType,
              fingerprint,
            );
            const stored = yield* storage.putImage(key, image);
            yield* lifecycle.markReady({
              key,
              fence,
              operationId: claim.operationId,
              observed: {
                contentLength: image.size,
                contentType,
                fingerprint: stored.fingerprint,
              },
            });
            uploadedKeys.push(key);
            imageKeys.push(key);
          }
          thumbnailKey = imageKeys[0] ?? "";
        } else {
          if (data.thumbnail === undefined) {
            return yield* Effect.fail(
              new ValidationError({ message: "Thumbnail is required" }),
            );
          }
          const key = thumbnailObjectKey(claim.operationId);
          const fingerprint = yield* fileDigest(data.thumbnail);
          const fence = yield* prepareAndReady(
            key,
            "thumbnail",
            data.thumbnail.size,
            "image/jpeg",
            fingerprint,
          );
          const stored = yield* storage.putThumbnail(key, data.thumbnail);
          yield* lifecycle.markReady({
            key,
            fence,
            operationId: claim.operationId,
            observed: {
              contentLength: data.thumbnail.size,
              contentType: "image/jpeg",
              fingerprint: stored.fingerprint,
            },
          });
          thumbnailKey = key;
          uploadedKeys.push(key);
        }

        const newPost = yield* db.transaction().execute((trx) =>
          Effect.gen(function* () {
            const newPost = yield* trx.executeTakeFirstOrError(
              trx
                .insertInto("posts")
                .values({
                  animeTitle: data.animeTitle ? data.animeTitle : null,
                  chapterNumber: data.chapterNumber ?? null,
                  description,
                  episodeNumber: data.episodeNumber ?? null,
                  relatedPostId,
                  seasonNumber: data.seasonNumber ?? null,
                  source,
                  sourceType: data.sourceType ?? null,
                  thumbnailKey,
                  title,
                  userId,
                  videoKey: finalVideoKey,
                  videoMetadata:
                    videoMetadata === undefined
                      ? "{}"
                      : Schema.encodeSync(
                          Schema.fromJsonString(VideoMetadataSchema),
                        )(videoMetadata),
                  volumeNumber: data.volumeNumber ?? null,
                })
                .returningAll(),
            );

            const postId = asPostId(newPost.id);

            if (imageKeys.length > 0) {
              yield* trx.execute(
                trx.insertInto("post_images").values(
                  imageKeys.map((storageKey, index) => {
                    const dimensions = data.imageDimensions?.[index];
                    return {
                      height: dimensions?.height ?? null,
                      postId,
                      position: index,
                      storageKey,
                      width: dimensions?.width ?? null,
                    };
                  }),
                ),
              );
            }

            // Strip reserved tag names from user input, then append the correct
            // one so every post always carries its implicit media-kind tag.
            const reservedNames: ReadonlySet<string> = new Set(
              RESERVED_TAG_NAMES,
            );
            const effectiveTags = [
              ...tags.filter((tag) => !reservedNames.has(tag.name)),
              { name: finalVideoKey === null ? "image" : "video" },
            ];
            yield* resolveAndLinkTags(trx, postId, effectiveTags);

            yield* finishOperationInTransaction(
              trx,
              {
                fence: claimFence,
                operationId: claim.operationId,
                result: (() => {
                  const result: MediaOperationResult = {
                    imageKeys,
                    postId,
                    thumbnailKey,
                    state: "created",
                    ...(finalVideoKey !== null && { videoKey: finalVideoKey }),
                  };
                  return result;
                })(),
              },
              yield* DateTime.nowAsDate,
            );

            yield* Effect.logInfo("Tags linked to post").pipe(
              Effect.annotateLogs({
                postId: String(postId),
                tagCount: effectiveTags.length,
              }),
            );

            return newPost;
          }),
        );

        yield* Effect.logInfo("Upload completed").pipe(
          Effect.annotateLogs("postId", String(newPost.id)),
        );

        return newPost;
      }).pipe(Effect.exit);

      if (Exit.isFailure(outcome)) {
        yield* Effect.forEach(uploadedKeys, (key) =>
          storage.deleteFile(key).pipe(Effect.ignore),
        ).pipe(Effect.ignore);

        return yield* Effect.failCause(outcome.cause);
      }

      return yield* Effect.try({
        try: () => parse(postsSelectSchema)(outcome.value),
        catch: (error) =>
          new RowParseError({
            message: "There was an error processing the upload result",
            cause: error,
          }),
      }).pipe(
        Effect.tap((parsed) =>
          points.awardOrLog({
            userId,
            action: "post-upload",
            refId: parsed.id,
            actorId: userId,
          }),
        ),
      );
    });

    const createVideoUploadUrl = Effect.fn("PostsService.createVideoUploadUrl")(
      function* (data: Schema.Schema.Type<typeof createVideoUploadUrlSchema>) {
        const sessions = yield* SessionService;
        const user = yield* sessions.requireUser(
          "You must be logged in to upload a post",
        );

        const ext = data.fileName.split(".").pop() ?? "";
        const key = pendingVideoObjectKey(
          user.id,
          data.operationKey ?? crypto.randomUUID(),
          ext,
        );
        return yield* storage.presignDeterministicVideoUpload(
          user.id,
          key,
          videoContentType(ext),
        );
      },
    );

    const getByTag = Effect.fn("PostsService.getByTag")(function* (
      data: Schema.Schema.Type<typeof postByTagSchema>,
    ) {
      const { tag: tagName, page } = data;

      let query = db
        .selectFrom("posts")
        .innerJoin("post_tags", "post_tags.postId", "posts.id")
        .innerJoin("tags", "tags.id", "post_tags.tagId")
        .where("tags.name", "=", tagName)
        .selectAll("posts");

      const countQuery = query
        .clearSelect()
        .select((eb) => eb.fn.countAll().as("count"));
      const countResult = yield* db.executeTakeFirstOrUndefined(countQuery);
      const totalCount = Number(countResult?.count ?? 0);

      const pagination = computePagination(totalCount, {
        page,
        pageSize: PAGE_SIZE,
      });

      query = query.orderBy("posts.createdAt", "desc");

      const items = yield* db.execute(
        query.offset(pagination.offset).limit(PAGE_SIZE),
      );

      const parsed = yield* Effect.try({
        try: () => parse(Schema.Array(postsSelectSchema))(items),
        catch: (error) =>
          new RowParseError({
            message: `Error processing posts by tag: ${String(error)}`,
          }),
      });

      const parsedWithVotes = yield* mergeVoteCounts(db, parsed);

      const popularTags = yield* fetchPopularTagsForPosts(db, [
        (eb) =>
          eb("posts.id", "in", (eb2) =>
            eb2
              .selectFrom("posts")
              .innerJoin("post_tags", "post_tags.postId", "posts.id")
              .innerJoin("tags", "tags.id", "post_tags.tagId")
              .where("tags.name", "=", tagName)
              .select("posts.id"),
          ),
      ]);

      return {
        data: parsedWithVotes,
        meta: {
          pagination,
          popularTags,
        },
      };
    });

    const fetchDetailVersion = Effect.fn("PostsService.fetchDetailVersion")(
      function* (postId: PostId) {
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

    const update = Effect.fn("PostsService.update")(function* (
      data: Schema.Schema.Type<typeof updatePostInputSchema>,
    ) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireUser(
        "You must be logged in to update a post",
      );

      const { postId, title, description, source, relatedPostId, tags } = data;
      const requestFingerprint = yield* operationRequestFingerprint({
        fileDigests: [],
        operationKind: "post-update",
        payload: {
          description,
          postId,
          relatedPostId: relatedPostId ?? null,
          source: source ?? null,
          tags: tags.map((tag) => ({ id: tag.id ?? null, name: tag.name })),
          title,
        },
        userId: user.id,
        version: data.expectedVersion,
      });

      yield* Effect.logInfo("Post update started").pipe(
        Effect.annotateLogs({
          postId: String(postId),
          userId: user.id,
        }),
      );

      const postOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("posts")
          .select(["id", "userId"])
          .where("id", "=", postId),
      );

      yield* ensureOwnedOrStaff({
        resource: postOption,
        selectOwnerId: (row) => row.userId,
        userId: user.id,
        userRole: getUserRole(user),
        notFound: new PostNotFoundError({
          message: `Post ${postId} not found`,
          postId,
        }),
        forbidden: new ForbiddenError({
          message: "You can only update your own posts",
        }),
      });

      yield* validateRelatedPost({ postId, relatedPostId });

      const claim = yield* lifecycle.claimOperation({
        kind: "post-update",
        operationKey: data.operationKey,
        requestFingerprint,
        userId: user.id,
      });

      if (claim.outcome === "replayed") {
        const replayedPost = yield* db.executeTakeFirstOrError(
          db.selectFrom("posts").selectAll().where("id", "=", postId),
        );
        return yield* Effect.try({
          try: () => parse(postsSelectSchema)(replayedPost),
          catch: (error) =>
            new RowParseError({
              message: "There was an error processing the replay result",
              cause: error,
            }),
        });
      }

      const changes: PostUpdateChanges = { description, title };
      if (relatedPostId !== undefined) changes.relatedPostId = relatedPostId;
      if (source !== undefined) changes.source = source;

      const updatedPost = yield* db.transaction().execute((trx) =>
        Effect.gen(function* () {
          yield* updatePostWithVersionInTransaction(trx, {
            changes,
            expectedVersion: data.expectedVersion,
            ownerUserId: user.id,
            postId,
          });
          const updatedPost = yield* trx.executeTakeFirstOrError(
            trx.selectFrom("posts").selectAll().where("id", "=", postId),
          );

          // Tag links are rebuilt wholesale: delete-then-relink. Reserved media
          // tags ("video"/"image") are stripped from user input and re-applied
          // server-side so every post keeps its implicit media-kind tag.
          yield* trx.execute(
            trx.deleteFrom("post_tags").where("postId", "=", postId),
          );
          const imageRow = yield* trx.executeTakeFirstOrUndefined(
            trx
              .selectFrom("post_images")
              .select("postId")
              .where("postId", "=", postId)
              .limit(1),
          );
          const reservedNames: ReadonlySet<string> = new Set(
            RESERVED_TAG_NAMES,
          );
          const userTags = (tags ?? []).filter(
            (tag) => !reservedNames.has(tag.name),
          );
          yield* resolveAndLinkTags(trx, postId, [
            ...userTags,
            { name: imageRow ? "image" : "video" },
          ]);

          yield* finishOperationInTransaction(
            trx,
            {
              fence: claim.fence,
              operationId: claim.operationId,
              result: { postId, state: "updated" },
            },
            yield* DateTime.nowAsDate,
          );

          return updatedPost;
        }),
      );

      const updatedPostParsed = yield* Effect.try({
        try: () => parse(postsSelectSchema)(updatedPost),
        catch: (error) =>
          new RowParseError({
            message: "There was an error processing the update result",
            cause: error,
          }),
      });

      yield* Effect.logInfo("Post updated").pipe(
        Effect.annotateLogs("postId", String(postId)),
      );

      return updatedPostParsed;
    });

    return {
      search,
      fetchRandomPost,
      fetchSeriesHub,
      fetchDetail,
      fetchDetailVersion,
      upload,
      createVideoUploadUrl,
      getByTag,
      update,
    };
  }),
}) {
  static readonly search = Effect.fn("PostsService.search")(function* (
    data: PostsSearchInput,
  ) {
    const svc = yield* PostsService;
    return yield* svc.search(data);
  });

  static readonly fetchRandomPost = Effect.fn("PostsService.fetchRandomPost")(
    function* (data: Schema.Schema.Type<typeof randomPostSchema>) {
      const svc = yield* PostsService;
      return yield* svc.fetchRandomPost(data);
    },
  );

  static readonly fetchDetail = Effect.fn("PostsService.fetchDetail")(
    function* (postId: PostId) {
      const svc = yield* PostsService;
      return yield* svc.fetchDetail(postId);
    },
  );

  static readonly fetchDetailVersion = Effect.fn(
    "PostsService.fetchDetailVersion",
  )(function* (postId: PostId) {
    const svc = yield* PostsService;
    return yield* svc.fetchDetailVersion(postId);
  });

  static readonly fetchSeriesHub = Effect.fn("PostsService.fetchSeriesHub")(
    function* (data: Schema.Schema.Type<typeof seriesHubSchema>) {
      const svc = yield* PostsService;
      return yield* svc.fetchSeriesHub(data);
    },
  );

  static readonly upload = Effect.fn("PostsService.upload")(function* (
    data: Schema.Schema.Type<typeof FormFileUploadSchema>,
  ) {
    const svc = yield* PostsService;
    return yield* svc.upload(data);
  });

  static readonly createVideoUploadUrl = Effect.fn(
    "PostsService.createVideoUploadUrl",
  )(function* (data: Schema.Schema.Type<typeof createVideoUploadUrlSchema>) {
    const svc = yield* PostsService;
    return yield* svc.createVideoUploadUrl(data);
  });

  static readonly getByTag = Effect.fn("PostsService.getByTag")(function* (
    data: Schema.Schema.Type<typeof postByTagSchema>,
  ) {
    const svc = yield* PostsService;
    return yield* svc.getByTag(data);
  });

  static readonly update = Effect.fn("PostsService.update")(function* (
    data: Schema.Schema.Type<typeof updatePostInputSchema>,
  ) {
    const svc = yield* PostsService;
    return yield* svc.update(data);
  });
}

const resolveAndLinkTags = Effect.fn("resolveAndLinkTags")(function* (
  db: Pick<
    EffectTransition<DB>,
    "execute" | "executeTakeFirstOrError" | "insertInto" | "selectFrom"
  >,
  postId: PostId,
  tags: ReadonlyArray<{ id?: number | undefined; name: string }>,
) {
  const tagIds = [
    ...new Set(tags.flatMap((tag) => (tag.id === undefined ? [] : [tag.id]))),
  ];
  if (tagIds.length > 0) {
    const persistedTags = yield* db.execute(
      db.selectFrom("tags").select(["id", "name"]).where("id", "in", tagIds),
    );
    const persistedTagNames = new Map(
      persistedTags.map((tag) => [tag.id, tag.name]),
    );
    for (const tag of tags) {
      if (tag.id !== undefined && persistedTagNames.get(tag.id) !== tag.name) {
        return yield* Effect.fail(
          new ValidationError({ message: "Tag selection is invalid" }),
        );
      }
    }
  }

  const allTagIds: number[] = [];

  // Upserts retain row locks until commit. Every request must acquire them
  // in the same order, even when users submit the same tags in reverse order.
  const orderedTags = [...tags].sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  );
  for (const tag of orderedTags) {
    if (tag.id === undefined) {
      const newTag = yield* db.executeTakeFirstOrError(
        db
          .insertInto("tags")
          .values({ name: tag.name })
          .onConflict((oc) => oc.column("name").doUpdateSet({ name: tag.name }))
          .returning("id"),
      );
      allTagIds.push(newTag.id);
    } else {
      allTagIds.push(tag.id);
    }
  }

  const uniqueTagIds = [...new Set(allTagIds)];
  if (uniqueTagIds.length > 0) {
    yield* db.execute(
      db
        .insertInto("post_tags")
        .values(uniqueTagIds.map((tagId) => ({ postId, tagId }))),
    );
  }
});

export const PostsServiceLive = Layer.effect(
  PostsService,
  PostsService.make,
).pipe(
  Layer.provideMerge(PointsServiceLive),
  Layer.provideMerge(LifecycleServiceLive),
);

export const searchPosts = createServerFn({ strict: { output: false } })
  .validator(parseStrict(searchPostsBaseSchema))
  .handler(
    createHandler(
      PostsServiceLive,
      baseLayerFactories.auth,
    )(PostsService.search),
  );

export const fetchRandomPostId = createServerFn({ strict: { output: false } })
  .validator(parseStrict(randomPostSchema))
  .handler(
    createHandler(
      PostsServiceLive,
      baseLayerFactories.db,
    )(PostsService.fetchRandomPost),
  );

export const fetchSeriesHub = createServerFn({ strict: { output: false } })
  .validator(parseStrict(seriesHubSchema))
  .handler(
    createHandler(
      PostsServiceLive,
      baseLayerFactories.db,
    )(PostsService.fetchSeriesHub),
  );

export const fetchPostDetailVersion = createServerFn({
  strict: { output: false },
})
  .validator(parse(Schema.Number))
  .handler(
    createHandler(
      PostsServiceLive,
      baseLayerFactories.db,
    )((postId: number) => PostsService.fetchDetailVersion(asPostId(postId))),
  );

export const fetchPostDetail = createServerFn({ strict: { output: false } })
  // Scalar payloads stay unbranded on the wire (see fetchComments pattern).
  .validator(parse(Schema.Number))
  .handler(
    createHandler(
      PostsServiceLive,
      baseLayerFactories.db,
    )((postId: number) => PostsService.fetchDetail(asPostId(postId))),
  );

export const uploadPost = createServerFn({ method: "POST" })
  // oxlint-disable-next-line effecttsgo/async-function -- server-fn validators are the sanctioned pre-handler boundary; the JPEG magic-byte check needs async File I/O, which Effect cannot express in a validator.
  .validator(async (data: FormData) => {
    const raw = Object.fromEntries(data.entries());
    // SAFETY: raw["tags"] is a JSON string field in the multipart form; the
    // schema re-validates the parsed value against FormFileUploadSchema.
    const tags = raw["tags"] ? JSON.parse(raw["tags"] as string) : [];
    // SAFETY: raw["videoMetadata"] is a JSON string field in the multipart form;
    // the schema re-validates the parsed value against FormFileUploadSchema.
    const videoMetadata = raw["videoMetadata"]
      ? JSON.parse(raw["videoMetadata"] as string)
      : undefined;
    // SAFETY: FormData scalar entries are strings; this field is JSON encoded
    // by buildFormData and parsed immediately before schema validation.
    const imageDimensions = raw["imageDimensions"]
      ? JSON.parse(raw["imageDimensions"] as string)
      : undefined;
    // Multiple files arrive as repeated "images" entries, which
    // Object.fromEntries collapses to the last one — collect them explicitly.
    const imageFiles = data
      .getAll("images")
      .filter((entry): entry is File => entry instanceof File);
    // SAFETY: the object deliberately mixes arbitrary FormData keys (validated
    // away by the strict schema) with the known fields; the inferred value
    // type is a string-keyed map whose values are validated downstream.
    // SAFETY: the object deliberately mixes arbitrary FormData keys (validated
    // away by the strict schema) with the known fields; the inferred value
    // type is a string-keyed map whose values are validated downstream.
    // The images key is only added when files exist: `optionalKey` rejects an
    // explicit `undefined` value, which would fail the strict parse below.
    const normalized = {
      ...raw,
      imageDimensions,
      tags,
      videoMetadata,
      ...(imageFiles.length > 0 && { images: imageFiles }),
    };
    const parsed = parseStrict(FormFileUploadSchema)(normalized);
    // Magic-byte checks need reading file bytes, so they run here before any
    // storage/DB work: supported-image bytes for image posts, JPEG bytes for
    // generated video thumbnails.
    if (parsed.images !== undefined && parsed.images.length > 0) {
      for (const image of parsed.images) {
        await assertSupportedImageFile(image);
      }
    } else {
      // SAFETY: the schema filter rejects video-less payloads, so reaching
      // this branch means the post carries a video key and its thumbnail.
      await assertThumbnailIsJpeg(parsed.thumbnail as File);
    }
    return parsed;
  })
  .handler(
    createHandler(
      PostsServiceLive,
      baseLayerFactories.auth,
    )(PostsService.upload),
  );

export const createVideoUploadUrl = createServerFn({ method: "POST" })
  .validator(parseStrict(createVideoUploadUrlSchema))
  .handler(
    createHandler(
      PostsServiceLive,
      baseLayerFactories.auth,
    )(PostsService.createVideoUploadUrl),
  );

export const updatePost = createServerFn({ method: "POST" })
  .validator(parseStrict(updatePostInputSchema))
  .handler(
    createHandler(
      PostsServiceLive,
      baseLayerFactories.auth,
    )(PostsService.update),
  );
