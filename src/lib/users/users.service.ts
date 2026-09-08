import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer, Option, Schema } from "effect";
import { postsSelectSchema, type PostWithVotes } from "src/lib/db/schema";

import { RoleSchema, roleAtLeast, type Role } from "../auth/roles";
import { KyselyDB } from "../db/context";
import { toIsoTimestamp } from "../db/schema/timestamp";
import { SqlError } from "../effect/effect.utils";
import { parse, parseStrict } from "../effect/schema.utils";
import { RowParseError, UserNotFoundError } from "../errors";
import { computePagination } from "../pagination/pagination";
import { escapeLikePattern } from "../posts/search-pattern";
import { baseLayerFactories, createHandler } from "../server-fn.handler";
import { fetchPopularTagsForPosts, mapPopularTags } from "../tags/tags.utils";
import { mergeVoteCounts } from "../votes/votes.utils";
import {
  contributorProfileSchema,
  fetchContributorProfileInputSchema,
  fetchUserInputSchema,
  mentionableUserSchema,
  mentionSearchInputSchema,
  type ContributorProfile,
  type ContributorProfileBadge,
  userPublicSchema,
} from "./users.schema";

const PAGE_SIZE = 30;
const PROFILE_PLAYLIST_LIMIT = 4;
// The mention dropdown stays small: the composer shows a handful of
// candidates for the prefix being typed.
const MENTION_SEARCH_LIMIT = 8;

export class UsersService extends Context.Service<
  UsersService,
  {
    readonly all: () => Effect.Effect<
      readonly Schema.Schema.Type<typeof userPublicSchema>[],
      SqlError | RowParseError
    >;
    /** Active users whose username starts with the query, for @mention autocomplete. */
    readonly searchMentionable: (
      data: Schema.Schema.Type<typeof mentionSearchInputSchema>,
    ) => Effect.Effect<
      readonly Schema.Schema.Type<typeof mentionableUserSchema>[],
      SqlError | RowParseError
    >;
    readonly userPosts: (
      data: Schema.Schema.Type<typeof fetchUserInputSchema>,
    ) => Effect.Effect<
      {
        data: readonly PostWithVotes[];
        meta: {
          pagination: {
            currentPage: number;
            hasMore: boolean;
            hasPrevious: boolean;
            limit: number;
            offset: number;
            total: number;
            totalPages: number;
          };
          popularTags: ReturnType<typeof mapPopularTags>;
        };
        user: { id: string; image: string | null; name: string };
      },
      SqlError | RowParseError | UserNotFoundError
    >;
    readonly contributorProfile: (
      data: Schema.Schema.Type<typeof fetchContributorProfileInputSchema>,
    ) => Effect.Effect<
      ContributorProfile,
      SqlError | RowParseError | UserNotFoundError
    >;
  }
>()("UsersService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;

    const getProfileBadges = (
      role: Role,
      acceptedEdits: number,
      publicPlaylistCount: number,
    ): ReadonlyArray<ContributorProfileBadge> => {
      const badges: ContributorProfileBadge[] = [];

      if (roleAtLeast(role, "admin")) {
        badges.push({ color: "red", id: "admin", label: "Admin" });
      } else if (roleAtLeast(role, "moderator")) {
        badges.push({
          color: "orange",
          id: "moderator",
          label: "Moderator",
        });
      } else if (roleAtLeast(role, "uploader")) {
        badges.push({ color: "blue", id: "uploader", label: "Uploader" });
      }

      if (acceptedEdits > 0) {
        badges.push({
          color: "green",
          id: "editor",
          label: "Community editor",
        });
      }

      if (publicPlaylistCount > 0) {
        badges.push({
          color: "gray",
          id: "curator",
          label: "Playlist curator",
        });
      }

      return badges;
    };

    const fetchPublicPlaylistSummaries = Effect.fn(
      "UsersService.fetchPublicPlaylistSummaries",
    )(function* (userId: string) {
      const playlists = yield* db.execute(
        db
          .selectFrom("playlists")
          .select(["description", "id", "title"])
          .where("user_id", "=", userId)
          .where("is_public", "=", true)
          .orderBy("created_at", "desc")
          .limit(PROFILE_PLAYLIST_LIMIT),
      );

      if (playlists.length === 0) {
        return [];
      }

      const playlistIds = playlists.map((playlist) => playlist.id);
      const postCounts = yield* db.execute(
        db
          .selectFrom("playlist_posts")
          .innerJoin("posts", "posts.id", "playlist_posts.post_id")
          .select([
            "playlist_posts.playlist_id",
            db.fn.countAll<number>().as("count"),
          ])
          .where("playlist_posts.playlist_id", "in", playlistIds)
          .groupBy("playlist_posts.playlist_id"),
      );
      const countByPlaylistId = new Map(
        postCounts.map((row) => [row.playlist_id, Number(row.count)]),
      );

      const thumbnailRows = yield* db.execute(
        db
          .selectFrom("playlist_posts")
          .innerJoin("posts", "posts.id", "playlist_posts.post_id")
          .select(["playlist_posts.playlist_id", "posts.thumbnailKey"])
          .where("playlist_posts.playlist_id", "in", playlistIds)
          .orderBy("playlist_posts.position", "asc"),
      );
      const thumbnailByPlaylistId = new Map<number, string | null>();
      for (const row of thumbnailRows) {
        if (!thumbnailByPlaylistId.has(row.playlist_id)) {
          thumbnailByPlaylistId.set(row.playlist_id, row.thumbnailKey);
        }
      }

      return playlists.map((playlist) => ({
        description: playlist.description,
        id: playlist.id,
        postCount: countByPlaylistId.get(playlist.id) ?? 0,
        thumbnailKey: thumbnailByPlaylistId.get(playlist.id) ?? null,
        title: playlist.title,
      }));
    });

    const all = Effect.fn("UsersService.all")(function* () {
      // Skip anonymized (deleted) accounts: they are inert shells kept only
      // so posts/comments can render their "Deleted user" attribution.
      const data = yield* db.execute(
        db
          .selectFrom("user")
          .select(["id", "name", "image"])
          .where("deletedAt", "is", null),
      );
      return yield* Effect.try({
        try: () => parse(Schema.Array(userPublicSchema))(data),
        catch: (error) =>
          new RowParseError({
            message: "There was an error processing the search results",
            cause: error,
          }),
      });
    });

    const searchMentionable = Effect.fn("UsersService.searchMentionable")(
      function* (data: Schema.Schema.Type<typeof mentionSearchInputSchema>) {
        // Prefix match on the handle OR the display name; handles are stored
        // lowercase so the query is lowercased too (case-insensitive typing
        // in the composer). Names keep their casing, hence ilike.
        const pattern = `${escapeLikePattern(data.query.toLowerCase())}%`;
        const rows = yield* db.execute(
          db
            .selectFrom("user")
            .select(["id", "name", "image", "username"])
            .where("deletedAt", "is", null)
            .where((eb) =>
              eb.or([
                eb("username", "like", pattern),
                eb("name", "ilike", pattern),
              ]),
            )
            .orderBy("username", "asc")
            .limit(MENTION_SEARCH_LIMIT),
        );
        return yield* Effect.try({
          try: () => parse(Schema.Array(mentionableUserSchema))(rows),
          catch: (error) =>
            new RowParseError({
              message: "Error processing mention search results",
              cause: error,
            }),
        });
      },
    );

    const userPosts = Effect.fn("UsersService.userPosts")(function* (
      data: Schema.Schema.Type<typeof fetchUserInputSchema>,
    ) {
      const { userId, tags, q, page } = data;

      const userInfoOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("user")
          .select(["name", "image", "id"])
          .where("id", "=", userId),
      );

      const userInfo = yield* Option.match(userInfoOption, {
        onNone: () =>
          Effect.logError("User not found").pipe(
            Effect.annotateLogs("userId", userId),
            Effect.flatMap(() =>
              Effect.fail(
                new UserNotFoundError({
                  message: `User ${userId} not found`,
                  userId,
                }),
              ),
            ),
          ),
        onSome: (value) => Effect.succeed(value),
      });

      let query = db
        .selectFrom("posts")
        .selectAll()
        .where("userId", "=", userId);

      if (q) {
        const pattern = `%${escapeLikePattern(q)}%`;
        query = query.where((eb) =>
          eb("title", "ilike", pattern).or("description", "ilike", pattern),
        );
      }

      if (tags.length > 0) {
        query = query
          .innerJoin("post_tags", "post_tags.postId", "posts.id")
          .innerJoin("tags", "tags.id", "post_tags.tagId")
          .where("tags.name", "in", tags)
          .selectAll("posts")
          .distinct();
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

      query = query.orderBy("id", "desc");

      const items = yield* db.execute(
        query.offset(pagination.offset).limit(PAGE_SIZE),
      );

      const posts = yield* Effect.try({
        try: () => parse(Schema.Array(postsSelectSchema))(items),
        catch: (error) =>
          new RowParseError({
            message: "Error processing user posts",
            cause: error,
          }),
      });

      const postsWithVotes = yield* mergeVoteCounts(db, posts);

      const popularTags = yield* fetchPopularTagsForPosts(db, [
        (eb) => eb("posts.userId", "=", userId),
      ]);

      return {
        data: postsWithVotes,
        meta: {
          pagination,
          popularTags,
        },
        user: userInfo,
      };
    });

    const contributorProfile = Effect.fn("UsersService.contributorProfile")(
      function* (
        data: Schema.Schema.Type<typeof fetchContributorProfileInputSchema>,
      ) {
        const userOption = yield* db.executeTakeFirstOption(
          db
            .selectFrom("user")
            .select(["createdAt", "id", "image", "name", "role", "username"])
            .where("id", "=", data.userId)
            .where("deletedAt", "is", null),
        );

        const user = yield* Option.match(userOption, {
          onNone: () =>
            Effect.fail(
              new UserNotFoundError({
                message: `User ${data.userId} not found`,
                userId: data.userId,
              }),
            ),
          onSome: Effect.succeed,
        });

        const role = yield* Effect.try({
          try: () => parse(RoleSchema)(user.role),
          catch: (error) =>
            new RowParseError({
              cause: error,
              message: "Error processing contributor profile",
            }),
        });

        const counts = yield* Effect.all({
          acceptedEdits: db
            .executeTakeFirstOrUndefined(
              db
                .selectFrom("post_edits")
                .select((eb) => eb.fn.countAll<number>().as("count"))
                .where("suggestedBy", "=", data.userId)
                .where("status", "=", "approved"),
            )
            .pipe(Effect.map((row) => Number(row?.count ?? 0))),
          comments: db
            .executeTakeFirstOrUndefined(
              db
                .selectFrom("comments")
                .select((eb) => eb.fn.countAll<number>().as("count"))
                .where("userId", "=", data.userId),
            )
            .pipe(Effect.map((row) => Number(row?.count ?? 0))),
          likesReceived: db
            .executeTakeFirstOrUndefined(
              db
                .selectFrom("post_votes")
                .innerJoin("posts", "posts.id", "post_votes.postId")
                .select((eb) => eb.fn.countAll<number>().as("count"))
                .where("posts.userId", "=", data.userId)
                .where("post_votes.vote", "=", "like"),
            )
            .pipe(Effect.map((row) => Number(row?.count ?? 0))),
          points: db
            .executeTakeFirstOrUndefined(
              db
                .selectFrom("points_ledger")
                .select((eb) => eb.fn.sum<number>("points").as("total"))
                .where("userId", "=", data.userId),
            )
            .pipe(Effect.map((row) => Number(row?.total ?? 0))),
          posts: db
            .executeTakeFirstOrUndefined(
              db
                .selectFrom("posts")
                .select((eb) => eb.fn.countAll<number>().as("count"))
                .where("userId", "=", data.userId),
            )
            .pipe(Effect.map((row) => Number(row?.count ?? 0))),
          publicPlaylistCount: db
            .executeTakeFirstOrUndefined(
              db
                .selectFrom("playlists")
                .select((eb) => eb.fn.countAll<number>().as("count"))
                .where("user_id", "=", data.userId)
                .where("is_public", "=", true),
            )
            .pipe(Effect.map((row) => Number(row?.count ?? 0))),
        });
        const publicPlaylists = yield* fetchPublicPlaylistSummaries(
          data.userId,
        );

        const profile = {
          acceptedEdits: counts.acceptedEdits,
          badges: getProfileBadges(
            role,
            counts.acceptedEdits,
            counts.publicPlaylistCount,
          ),
          comments: counts.comments,
          createdAt: toIsoTimestamp(user.createdAt),
          id: user.id,
          image: user.image,
          likesReceived: counts.likesReceived,
          name: user.name,
          points: counts.points,
          posts: counts.posts,
          publicPlaylistCount: counts.publicPlaylistCount,
          publicPlaylists,
          role,
          username: user.username,
        } satisfies ContributorProfile;

        return yield* Effect.try({
          try: () => parse(contributorProfileSchema)(profile),
          catch: (error) =>
            new RowParseError({
              cause: error,
              message: "Error processing contributor profile",
            }),
        });
      },
    );

    return { all, contributorProfile, searchMentionable, userPosts };
  }),
}) {
  static readonly all = Effect.fn("UsersService.all")(function* () {
    const svc = yield* UsersService;
    return yield* svc.all();
  });

  static readonly searchMentionable = Effect.fn(
    "UsersService.searchMentionable",
  )(function* (data: Schema.Schema.Type<typeof mentionSearchInputSchema>) {
    const svc = yield* UsersService;
    return yield* svc.searchMentionable(data);
  });

  static readonly userPosts = Effect.fn("UsersService.userPosts")(function* (
    data: Schema.Schema.Type<typeof fetchUserInputSchema>,
  ) {
    const svc = yield* UsersService;
    return yield* svc.userPosts(data);
  });

  static readonly contributorProfile = Effect.fn(
    "UsersService.contributorProfile",
  )(function* (
    data: Schema.Schema.Type<typeof fetchContributorProfileInputSchema>,
  ) {
    const svc = yield* UsersService;
    return yield* svc.contributorProfile(data);
  });
}

export const UsersServiceLive = Layer.effect(UsersService, UsersService.make);

export const fetchUsers = createServerFn().handler(
  createHandler(UsersServiceLive, baseLayerFactories.db)(UsersService.all),
);

export const fetchMentionableUsers = createServerFn({
  strict: { output: false },
})
  .validator(parseStrict(mentionSearchInputSchema))
  .handler(
    createHandler(
      UsersServiceLive,
      baseLayerFactories.db,
    )(UsersService.searchMentionable),
  );

export const fetchUserPosts = createServerFn()
  .validator(parseStrict(fetchUserInputSchema))
  .handler(
    createHandler(
      UsersServiceLive,
      baseLayerFactories.db,
    )(UsersService.userPosts),
  );

export const fetchContributorProfile = createServerFn()
  .validator(parseStrict(fetchContributorProfileInputSchema))
  .handler(
    createHandler(
      UsersServiceLive,
      baseLayerFactories.db,
    )(UsersService.contributorProfile),
  );
