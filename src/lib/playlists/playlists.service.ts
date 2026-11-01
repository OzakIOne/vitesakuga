import { createServerFn } from "@tanstack/react-start";
import { Context, DateTime, Effect, Layer, Option, Schema } from "effect";
import { UpdateObject } from "kysely";

import { authorizeOwned } from "../auth/policy";
import {
  SessionFetchError,
  SessionService,
  type AuthorizedActor,
} from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import {
  SqlError,
  SqlNoFirstResult,
  type EffectTransaction,
} from "../db/effect-kysely";
import type { DB } from "../db/kysely";
import { toIsoTimestamp } from "../db/schema/timestamp";
import { parse, parseStrict } from "../effect/schema.utils";
import {
  AccountSuspendedError,
  ForbiddenError,
  PlaylistNotFoundError,
  PostAlreadyInPlaylistError,
  PostNotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../errors";
import { asPostId, PlaylistId } from "../ids";
import {
  computePagination,
  type PaginationMeta,
} from "../pagination/pagination";
import { createEndpointHandler } from "../server-endpoint";
import { baseLayerFactories } from "../server-fn.handler";
import {
  addPostToPlaylistInputSchema,
  bulkAddPostsToPlaylistInputSchema,
  bulkRemovePostsFromPlaylistInputSchema,
  createPlaylistInputSchema,
  fetchPlaylistDetailSchema,
  fetchPublicPlaylistsSchema,
  removePostFromPlaylistInputSchema,
  reorderPlaylistPostsInputSchema,
  updatePlaylistInputSchema,
} from "./playlists.schema";

const PAGE_SIZE = 30;

type PlaylistRow = {
  id: number;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

type PlaylistWithMeta = {
  id: number;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  post_count: number;
  thumbnail_key: string | null;
};

type PublicPlaylistRow = PlaylistWithMeta & {
  user_name: string;
  user_image: string | null;
};

type PublicPlaylistsResult = {
  data: readonly PublicPlaylistRow[];
  meta: { pagination: PaginationMeta };
};

type PlaylistForPostCheck = {
  id: number;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  contains_post: boolean;
};

type PlaylistPostRow = {
  post_id: number;
  position: number;
  added_at: string;
  id: number | null;
  title: string | null;
  description: string | null;
  thumbnail_key: string | null;
  created_at: string | null;
  user_id: string | null;
  user_name: string | null;
  video_key: string | null;
};

type PostOrphan = {
  orphan: true;
  post_id: number;
  position: number;
  added_at: string;
};

export type PlaylistDetailResult = {
  playlist: PlaylistWithMeta;
  data: (PlaylistPostRow | PostOrphan)[];
  meta: { pagination: PaginationMeta };
};

type BulkAddPostsResult = {
  playlist_id: number;
  added: number;
  already_added: number;
  not_found: number;
};

type BulkRemovePostsResult = {
  playlist_id: number;
  removed: number;
};

export class PlaylistsService extends Context.Service<
  PlaylistsService,
  {
    readonly create: (
      data: Schema.Schema.Type<typeof createPlaylistInputSchema>,
    ) => Effect.Effect<
      PlaylistRow,
      | UnauthorizedError
      | AccountSuspendedError
      | ForbiddenError
      | SessionFetchError
      | SqlError
      | SqlNoFirstResult,
      SessionService
    >;
    readonly update: (
      data: Schema.Schema.Type<typeof updatePlaylistInputSchema>,
    ) => Effect.Effect<
      PlaylistRow,
      | UnauthorizedError
      | AccountSuspendedError
      | ForbiddenError
      | PlaylistNotFoundError
      | SessionFetchError
      | SqlError
      | SqlNoFirstResult,
      SessionService
    >;
    readonly delete_: (input: {
      playlistId: PlaylistId;
    }) => Effect.Effect<
      { success: boolean },
      | UnauthorizedError
      | AccountSuspendedError
      | ForbiddenError
      | PlaylistNotFoundError
      | SessionFetchError
      | SqlError,
      SessionService
    >;
    readonly addPost: (
      data: Schema.Schema.Type<typeof addPostToPlaylistInputSchema>,
    ) => Effect.Effect<
      { playlist_id: number; post_id: number; position: number },
      | UnauthorizedError
      | AccountSuspendedError
      | ForbiddenError
      | PlaylistNotFoundError
      | PostNotFoundError
      | PostAlreadyInPlaylistError
      | SessionFetchError
      | SqlError
      | SqlNoFirstResult,
      SessionService
    >;
    readonly removePost: (
      data: Schema.Schema.Type<typeof removePostFromPlaylistInputSchema>,
    ) => Effect.Effect<
      { success: boolean },
      | UnauthorizedError
      | AccountSuspendedError
      | ForbiddenError
      | PlaylistNotFoundError
      | SessionFetchError
      | SqlError,
      SessionService
    >;
    readonly bulkAddPosts: (
      data: Schema.Schema.Type<typeof bulkAddPostsToPlaylistInputSchema>,
    ) => Effect.Effect<
      BulkAddPostsResult,
      | UnauthorizedError
      | AccountSuspendedError
      | ForbiddenError
      | PlaylistNotFoundError
      | SessionFetchError
      | SqlError
      | SqlNoFirstResult,
      SessionService
    >;
    readonly bulkRemovePosts: (
      data: Schema.Schema.Type<typeof bulkRemovePostsFromPlaylistInputSchema>,
    ) => Effect.Effect<
      BulkRemovePostsResult,
      | UnauthorizedError
      | AccountSuspendedError
      | ForbiddenError
      | PlaylistNotFoundError
      | SessionFetchError
      | SqlError,
      SessionService
    >;
    readonly reorder: (
      data: Schema.Schema.Type<typeof reorderPlaylistPostsInputSchema>,
    ) => Effect.Effect<
      { success: boolean },
      | UnauthorizedError
      | AccountSuspendedError
      | ForbiddenError
      | PlaylistNotFoundError
      | SessionFetchError
      | SqlError
      | ValidationError,
      SessionService
    >;
    readonly fetchUserPlaylists: (
      userId: string,
    ) => Effect.Effect<
      readonly PlaylistWithMeta[],
      SessionFetchError | SqlError,
      SessionService
    >;
    readonly fetchPublicPlaylists: (
      data: Schema.Schema.Type<typeof fetchPublicPlaylistsSchema>,
    ) => Effect.Effect<PublicPlaylistsResult, SqlError>;
    readonly fetchDetail: (
      data: Schema.Schema.Type<typeof fetchPlaylistDetailSchema>,
    ) => Effect.Effect<
      PlaylistDetailResult,
      PlaylistNotFoundError | SessionFetchError | SqlError | SqlNoFirstResult,
      SessionService
    >;
    readonly fetchForPost: (
      postId: number,
    ) => Effect.Effect<
      readonly PlaylistForPostCheck[],
      AccountSuspendedError | ForbiddenError | UnauthorizedError | SessionFetchError | SqlError,
      SessionService
    >;
  }
>()("PlaylistsService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;

    const requireAuth = Effect.fn("PlaylistsService.requireAuth")(function* () {
      const sessions = yield* SessionService;
      return yield* sessions.requireActor("You must be logged in");
    });

    const requireReadAuth = Effect.fn("PlaylistsService.requireReadAuth")(
      function* () {
        const sessions = yield* SessionService;
        return yield* sessions.requireReadActor("You must be logged in");
      },
    );

    /** Auth + ownership in one step; every mutation starts with this. */
    const requireOwnedPlaylist = Effect.fn(
      "PlaylistsService.requireOwnedPlaylist",
    )(function* (playlistId: PlaylistId) {
      const actor = yield* requireAuth();
      return yield* requirePlaylistOwnership(playlistId, actor);
    });

    const requirePlaylistOwnership = Effect.fn(
      "PlaylistsService.requirePlaylistOwnership",
    )(function* (playlistId: PlaylistId, actor: AuthorizedActor) {
      const playlistOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("playlists")
          .select(["id", "user_id"])
          .where("id", "=", playlistId),
      );

      return yield* authorizeOwned({
        actor,
        resource: playlistOption,
        selectOwnerId: (row) => row.user_id,
        own: "playlists:edit-own",
        notFound: new PlaylistNotFoundError({
          message: `Playlist ${playlistId} not found`,
          playlistId,
        }),
        forbidden: new ForbiddenError({
          message: "You can only modify your own playlists",
        }),
      });
    });

    /** Next sequential position for appending to a playlist. */
    const nextPosition = Effect.fn("PlaylistsService.nextPosition")(function* (
      trx: EffectTransaction<DB>,
      playlistId: PlaylistId,
    ) {
      const maxResults = yield* trx.execute(
        trx
          .selectFrom("playlist_posts")
          .select(trx.fn.max("playlist_posts.position").as("max_pos"))
          .where("playlist_id", "=", playlistId),
      );
      // SAFETY: the aggregate row exposes max_pos under the alias used in
      // select(); indexing via keyof keeps the lookup type-safe.
      const maxPos = maxResults[0]?.["max_pos" as keyof (typeof maxResults)[0]];
      return (maxPos != null ? Number(maxPos) : -1) + 1;
    });

    /**
     * Rewrite positions 0..n-1 over the remaining rows after a removal, in
     * (position, added_at) order — shared by removePost and bulkRemovePosts.
     */
    const resequencePositions = Effect.fn(
      "PlaylistsService.resequencePositions",
    )(function* (trx: EffectTransaction<DB>, playlistId: PlaylistId) {
      const remaining = yield* trx.execute(
        trx
          .selectFrom("playlist_posts")
          .select(["post_id"])
          .where("playlist_id", "=", playlistId)
          .orderBy("position", "asc")
          .orderBy("created_at", "asc"),
      );

      let position = 0;
      for (const row of remaining) {
        yield* trx.execute(
          trx
            .updateTable("playlist_posts")
            .set({ position })
            .where("playlist_id", "=", playlistId)
            .where("post_id", "=", row.post_id),
        );
        position++;
      }
    });

    const create = Effect.fn("PlaylistsService.create")(function* (
      data: Schema.Schema.Type<typeof createPlaylistInputSchema>,
    ) {
      const user = yield* requireAuth();

      const playlist = yield* db.executeTakeFirstOrError(
        db
          .insertInto("playlists")
          .values({
            description: data.description ?? null,
            is_public: data.isPublic ?? false,
            title: data.title,
            user_id: user.id,
          })
          .returningAll(),
      );

      return {
        ...playlist,
        created_at: toIsoTimestamp(playlist.created_at),
        updated_at: toIsoTimestamp(playlist.updated_at),
      };
    });

    const update = Effect.fn("PlaylistsService.update")(function* (
      data: Schema.Schema.Type<typeof updatePlaylistInputSchema>,
    ) {
      yield* requireOwnedPlaylist(data.playlistId);

      const now = yield* DateTime.now;
      const setValues: UpdateObject<DB, "playlists"> = {
        updated_at: DateTime.toDate(now),
      };
      if (data.title !== undefined) setValues["title"] = data.title;
      if (data.description !== undefined)
        setValues["description"] = data.description;
      if (data.isPublic !== undefined) setValues["is_public"] = data.isPublic;

      const updated = yield* db.executeTakeFirstOrError(
        db
          .updateTable("playlists")
          .set(setValues)
          .where("id", "=", data.playlistId)
          .returningAll(),
      );

      return {
        ...updated,
        created_at: toIsoTimestamp(updated.created_at),
        updated_at: toIsoTimestamp(updated.updated_at),
      };
    });

    const delete_ = Effect.fn("PlaylistsService.delete_")(function* ({
      playlistId,
    }: {
      playlistId: PlaylistId;
    }) {
      yield* requireOwnedPlaylist(playlistId);

      yield* db.execute(
        db.deleteFrom("playlists").where("id", "=", playlistId),
      );

      return { success: true };
    });

    const addPost = Effect.fn("PlaylistsService.addPost")(function* (
      data: Schema.Schema.Type<typeof addPostToPlaylistInputSchema>,
    ) {
      yield* requireOwnedPlaylist(data.playlistId);

      const postOption = yield* db.executeTakeFirstOption(
        db.selectFrom("posts").select(["id"]).where("id", "=", data.postId),
      );

      yield* Option.match(postOption, {
        onNone: () =>
          Effect.fail(
            new PostNotFoundError({
              message: `Post ${data.postId} not found`,
              postId: data.postId,
            }),
          ),
        onSome: () => Effect.succeed(undefined),
      });

      const inserted = yield* db.transaction((trx) =>
        Effect.gen(function* () {
          yield* trx.executeTakeFirstOrError(
            trx
              .selectFrom("playlists")
              .select(["id"])
              .where("id", "=", data.playlistId)
              .forUpdate(),
          );

          const existing = yield* trx.executeTakeFirstOption(
            trx
              .selectFrom("playlist_posts")
              .selectAll()
              .where("playlist_id", "=", data.playlistId)
              .where("post_id", "=", data.postId),
          );

          if (Option.isSome(existing)) {
            return yield* new PostAlreadyInPlaylistError({
              message: `Post ${data.postId} is already in playlist ${data.playlistId}`,
              playlistId: data.playlistId,
              postId: data.postId,
            });
          }

          const nextPositionValue = yield* nextPosition(trx, data.playlistId);
          return yield* trx.executeTakeFirstOrError(
            trx
              .insertInto("playlist_posts")
              .values({
                playlist_id: data.playlistId,
                position: nextPositionValue,
                post_id: data.postId,
              })
              .returningAll(),
          );
        }),
      );

      return {
        playlist_id: inserted.playlist_id,
        post_id: inserted.post_id,
        position: inserted.position,
      };
    });

    const removePost = Effect.fn("PlaylistsService.removePost")(function* (
      data: Schema.Schema.Type<typeof removePostFromPlaylistInputSchema>,
    ) {
      yield* requireOwnedPlaylist(data.playlistId);

      yield* db.transaction((trx) =>
        Effect.gen(function* () {
          yield* trx.execute(
            trx
              .deleteFrom("playlist_posts")
              .where("playlist_id", "=", data.playlistId)
              .where("post_id", "=", data.postId),
          );

          yield* resequencePositions(trx, data.playlistId);
        }),
      );

      return { success: true };
    });

    const bulkAddPosts = Effect.fn("PlaylistsService.bulkAddPosts")(function* (
      data: Schema.Schema.Type<typeof bulkAddPostsToPlaylistInputSchema>,
    ) {
      yield* requireOwnedPlaylist(data.playlistId);

      const uniqueIds = [...new Set(data.postIds)];

      return yield* db.transaction((trx) =>
        Effect.gen(function* () {
          yield* trx.executeTakeFirstOrError(
            trx
              .selectFrom("playlists")
              .select(["id"])
              .where("id", "=", data.playlistId)
              .forUpdate(),
          );

          const existingRows = yield* trx.execute(
            trx
              .selectFrom("playlist_posts")
              .select(["post_id"])
              .where("playlist_id", "=", data.playlistId)
              .where("post_id", "in", uniqueIds),
          );
          const existingSet = new Set(existingRows.map((row) => row.post_id));

          const existingPosts = yield* trx.execute(
            trx.selectFrom("posts").select(["id"]).where("id", "in", uniqueIds),
          );
          const existingPostsSet = new Set(
            existingPosts.map((post) => post.id),
          );

          const toAdd = uniqueIds.filter(
            (postId) =>
              !existingSet.has(postId) && existingPostsSet.has(postId),
          );
          const alreadyAdded = uniqueIds.filter((postId) =>
            existingSet.has(postId),
          ).length;
          const notFound = uniqueIds.filter(
            (postId) =>
              !existingSet.has(postId) && !existingPostsSet.has(postId),
          ).length;

          if (toAdd.length > 0) {
            let position = yield* nextPosition(trx, data.playlistId);

            for (const postId of toAdd) {
              yield* trx.execute(
                trx.insertInto("playlist_posts").values({
                  playlist_id: data.playlistId,
                  position,
                  post_id: postId,
                }),
              );
              position++;
            }
          }

          return {
            added: toAdd.length,
            already_added: alreadyAdded,
            not_found: notFound,
            playlist_id: data.playlistId,
          };
        }),
      );
    });

    const bulkRemovePosts = Effect.fn("PlaylistsService.bulkRemovePosts")(
      function* (
        data: Schema.Schema.Type<typeof bulkRemovePostsFromPlaylistInputSchema>,
      ) {
        yield* requireOwnedPlaylist(data.playlistId);

        const uniqueIds = [...new Set(data.postIds)];

        return yield* db.transaction((trx) =>
          Effect.gen(function* () {
            const toRemove = yield* trx.execute(
              trx
                .selectFrom("playlist_posts")
                .select(["post_id"])
                .where("playlist_id", "=", data.playlistId)
                .where("post_id", "in", uniqueIds),
            );

            if (toRemove.length > 0) {
              yield* trx.execute(
                trx
                  .deleteFrom("playlist_posts")
                  .where("playlist_id", "=", data.playlistId)
                  .where("post_id", "in", uniqueIds),
              );

              yield* resequencePositions(trx, data.playlistId);
            }

            return {
              playlist_id: data.playlistId,
              removed: toRemove.length,
            };
          }),
        );
      },
    );

    const reorder = Effect.fn("PlaylistsService.reorder")(function* (
      data: Schema.Schema.Type<typeof reorderPlaylistPostsInputSchema>,
    ) {
      yield* requireOwnedPlaylist(data.playlistId);

      const currentPostIds = yield* db.execute(
        db
          .selectFrom("playlist_posts")
          .select(["post_id"])
          .where("playlist_id", "=", data.playlistId),
      );

      // SAFETY: playlist_posts.post_id is a FK to posts.id, so the row values
      // satisfy the PostId contract by construction.
      const currentSet = new Set(
        currentPostIds.map((row) => asPostId(row.post_id)),
      );
      const submittedSet = new Set(data.items.map((item) => item.postId));

      if (
        currentSet.size !== submittedSet.size ||
        [...currentSet].some((postId) => !submittedSet.has(postId))
      ) {
        return yield* new ValidationError({
          message:
            "Reorder items must cover every post in the playlist exactly once",
        });
      }

      yield* db.transaction((trx) =>
        Effect.gen(function* () {
          for (const item of data.items) {
            yield* trx.execute(
              trx
                .updateTable("playlist_posts")
                .set({ position: item.position })
                .where("playlist_id", "=", data.playlistId)
                .where("post_id", "=", item.postId),
            );
          }
        }),
      );

      return { success: true };
    });

    const fetchPlaylistMeta = Effect.fn("PlaylistsService.fetchPlaylistMeta")(
      function* (playlistIds: number[]) {
        const postCounts = yield* db.execute(
          db
            .selectFrom("playlist_posts")
            .innerJoin("posts", "posts.id", "playlist_posts.post_id")
            .select([
              "playlist_posts.playlist_id",
              db.fn.countAll().as("count"),
            ])
            .where("playlist_posts.playlist_id", "in", playlistIds)
            .groupBy("playlist_posts.playlist_id"),
        );

        const countMap = new Map<number, number>();
        for (const c of postCounts) {
          // SAFETY: postCounts rows select playlist_id as a number column; the
          // keyof-typed index access keeps the lookup type-safe with the DB row type.
          countMap.set(
            c["playlist_id" as keyof typeof c] as number,
            Number(c.count),
          );
        }

        const thumbnailRows = yield* db.execute(
          db
            .selectFrom("playlist_posts")
            .innerJoin("posts", "posts.id", "playlist_posts.post_id")
            .select([
              "playlist_posts.playlist_id",
              "posts.thumbnailKey",
            ] as const)
            .where("playlist_posts.playlist_id", "in", playlistIds)
            .orderBy("playlist_posts.position", "asc"),
        );

        const thumbnailMap = new Map<number, string | null>();
        for (const row of thumbnailRows) {
          if (!thumbnailMap.has(row.playlist_id)) {
            thumbnailMap.set(row.playlist_id, row.thumbnailKey);
          }
        }

        return { countMap, thumbnailMap };
      },
    );

    const fetchUserPlaylists = Effect.fn("PlaylistsService.fetchUserPlaylists")(
      function* (userId: string) {
        const sessions = yield* SessionService;
        const actor = yield* sessions.getActor();
        const isOwner = actor?.id === userId;

        let query = db
          .selectFrom("playlists")
          .selectAll()
          .where("user_id", "=", userId);

        if (!isOwner) {
          query = query.where("is_public", "=", true);
        }

        const playlists = yield* db.execute(
          query.orderBy("playlists.created_at", "desc"),
        );

        if (playlists.length === 0) return [];

        const playlistIds = playlists.map((p) => p.id);
        const { countMap, thumbnailMap } =
          yield* fetchPlaylistMeta(playlistIds);

        return playlists.map((p) => ({
          ...p,
          created_at: toIsoTimestamp(p.created_at),
          updated_at: toIsoTimestamp(p.updated_at),
          post_count: countMap.get(p.id) ?? 0,
          thumbnail_key: thumbnailMap.get(p.id) ?? null,
        }));
      },
    );

    const fetchPublicPlaylists = Effect.fn(
      "PlaylistsService.fetchPublicPlaylists",
    )(function* (data: Schema.Schema.Type<typeof fetchPublicPlaylistsSchema>) {
      const { page } = data;

      const totalCountResult = yield* db.executeTakeFirstOrUndefined(
        db
          .selectFrom("playlists")
          .select(db.fn.countAll().as("count"))
          .where("is_public", "=", true),
      );
      const totalCount = Number(totalCountResult?.count ?? 0);

      const pagination = computePagination(totalCount, {
        page,
        pageSize: PAGE_SIZE,
      });

      const playlists = yield* db.execute(
        db
          .selectFrom("playlists")
          .innerJoin("user", "user.id", "playlists.user_id")
          .select([
            "playlists.id",
            "playlists.user_id",
            "playlists.title",
            "playlists.description",
            "playlists.is_public",
            "playlists.created_at",
            "playlists.updated_at",
            "user.name as userName",
            "user.image as userImage",
          ])
          .where("playlists.is_public", "=", true)
          .orderBy("playlists.created_at", "desc")
          .offset(pagination.offset)
          .limit(PAGE_SIZE),
      );

      if (playlists.length === 0) {
        return { data: [], meta: { pagination } };
      }

      const playlistIds = playlists.map((p) => p.id);
      const { countMap, thumbnailMap } = yield* fetchPlaylistMeta(playlistIds);

      const data_ = playlists.map((p) => ({
        created_at: toIsoTimestamp(p.created_at),
        description: p.description,
        id: p.id,
        is_public: p.is_public,
        post_count: countMap.get(p.id) ?? 0,
        thumbnail_key: thumbnailMap.get(p.id) ?? null,
        title: p.title,
        updated_at: toIsoTimestamp(p.updated_at),
        user_id: p.user_id,
        user_name: p.userName,
        user_image: p.userImage,
      }));

      return { data: data_, meta: { pagination } };
    });

    const fetchDetail = Effect.fn("PlaylistsService.fetchDetail")(function* (
      data: Schema.Schema.Type<typeof fetchPlaylistDetailSchema>,
    ) {
      const { playlistId, page } = data;
      const sessions = yield* SessionService;
      const actor = yield* sessions.getActor();
      const currentUserId = actor?.id;

      const playlistOption = yield* db.executeTakeFirstOption(
        db.selectFrom("playlists").selectAll().where("id", "=", playlistId),
      );

      const playlist = yield* Option.match(playlistOption, {
        onNone: () =>
          Effect.fail(
            new PlaylistNotFoundError({
              message: `Playlist ${playlistId} not found`,
              playlistId,
            }),
          ),
        onSome: (value) => Effect.succeed(value),
      });

      const isOwner = currentUserId === playlist.user_id;
      if (!playlist.is_public && !isOwner) {
        return yield* new PlaylistNotFoundError({
          message: `Playlist ${playlistId} not found`,
          playlistId,
        });
      }

      const postCountResult = yield* db.executeTakeFirstOrUndefined(
        db
          .selectFrom("playlist_posts")
          .select(db.fn.countAll().as("count"))
          .where("playlist_id", "=", playlistId),
      );
      const totalCount = Number(postCountResult?.count ?? 0);

      const pagination = computePagination(totalCount, {
        page,
        pageSize: PAGE_SIZE,
      });

      const playlistPosts = yield* db.execute(
        db
          .selectFrom("playlist_posts")
          .leftJoin("posts", "posts.id", "playlist_posts.post_id")
          .leftJoin("user", "user.id", "posts.userId")
          .select([
            "playlist_posts.post_id",
            "playlist_posts.position",
            "playlist_posts.created_at as added_at",
            "posts.id",
            "posts.title",
            "posts.description",
            "posts.thumbnailKey as thumbnail_key",
            "posts.createdAt as created_at",
            "posts.userId as user_id",
            "posts.videoKey as video_key",
            "user.name as user_name",
          ] as const)
          .where("playlist_posts.playlist_id", "=", playlistId)
          .orderBy("playlist_posts.position", "asc")
          .offset(pagination.offset)
          .limit(PAGE_SIZE),
      );

      const data_ = playlistPosts.map((pp): PlaylistPostRow | PostOrphan => {
        if (pp.id === null) {
          return {
            orphan: true,
            post_id: pp.post_id,
            position: pp.position,
            added_at: toIsoTimestamp(pp.added_at),
          };
        }

        return {
          post_id: pp.post_id,
          position: pp.position,
          added_at: toIsoTimestamp(pp.added_at),
          id: pp.id,
          title: pp.title,
          description: pp.description,
          thumbnail_key: pp.thumbnail_key,
          created_at:
            pp.created_at === null ? null : toIsoTimestamp(pp.created_at),
          user_id: pp.user_id,
          user_name: pp.user_name,
          video_key: pp.video_key,
        };
      });

      const thumbnail = yield* db.executeTakeFirstOption(
        db
          .selectFrom("playlist_posts")
          .innerJoin("posts", "posts.id", "playlist_posts.post_id")
          .select("posts.thumbnailKey")
          .where("playlist_posts.playlist_id", "=", playlistId)
          .where("posts.thumbnailKey", "is not", null)
          .orderBy("playlist_posts.position", "asc")
          .limit(1),
      );
      const thumbnailKey = Option.match(thumbnail, {
        onNone: () => null,
        onSome: (row) => row.thumbnailKey,
      });

      const playlistMeta: PlaylistWithMeta = {
        ...playlist,
        created_at: toIsoTimestamp(playlist.created_at),
        updated_at: toIsoTimestamp(playlist.updated_at),
        post_count: totalCount,
        thumbnail_key: thumbnailKey,
      };

      return {
        playlist: playlistMeta,
        data: data_,
        meta: { pagination },
      };
    });

    const fetchForPost = Effect.fn("PlaylistsService.fetchForPost")(function* (
      rawPostId: number,
    ) {
      const postId = asPostId(rawPostId);
      const user = yield* requireReadAuth();

      const playlists = yield* db.execute(
        db
          .selectFrom("playlists")
          .selectAll()
          .where("user_id", "=", user.id)
          .orderBy("playlists.created_at", "desc"),
      );

      if (playlists.length === 0) return [];

      const playlistIds = playlists.map((p) => p.id);

      const containingIds = yield* db.execute(
        db
          .selectFrom("playlist_posts")
          .select("playlist_id")
          .where("playlist_id", "in", playlistIds)
          .where("post_id", "=", postId),
      );

      const containingSet = new Set(containingIds.map((c) => c.playlist_id));

      return playlists.map((p) => ({
        ...p,
        created_at: toIsoTimestamp(p.created_at),
        updated_at: toIsoTimestamp(p.updated_at),
        contains_post: containingSet.has(p.id),
      }));
    });

    return {
      create,
      update,
      delete_,
      addPost,
      removePost,
      bulkAddPosts,
      bulkRemovePosts,
      reorder,
      fetchUserPlaylists,
      fetchPublicPlaylists,
      fetchDetail,
      fetchForPost,
    };
  }),
}) {}

export const PlaylistsServiceLive = Layer.effect(
  PlaylistsService,
  PlaylistsService.make,
);

export const createPlaylist = createServerFn({ method: "POST" })
  .validator(parseStrict(createPlaylistInputSchema))
  .handler(
    createEndpointHandler({
      service: PlaylistsService,
      operation: "create",
      layer: PlaylistsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const updatePlaylist = createServerFn({ method: "POST" })
  .validator(parseStrict(updatePlaylistInputSchema))
  .handler(
    createEndpointHandler({
      service: PlaylistsService,
      operation: "update",
      layer: PlaylistsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const deletePlaylist = createServerFn({ method: "POST" })
  .validator(parse(Schema.Struct({ playlistId: PlaylistId })))
  .handler(
    createEndpointHandler({
      service: PlaylistsService,
      operation: "delete_",
      layer: PlaylistsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const addPostToPlaylist = createServerFn({ method: "POST" })
  .validator(parseStrict(addPostToPlaylistInputSchema))
  .handler(
    createEndpointHandler({
      service: PlaylistsService,
      operation: "addPost",
      layer: PlaylistsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const removePostFromPlaylist = createServerFn({ method: "POST" })
  .validator(parseStrict(removePostFromPlaylistInputSchema))
  .handler(
    createEndpointHandler({
      service: PlaylistsService,
      operation: "removePost",
      layer: PlaylistsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const bulkAddPostsToPlaylist = createServerFn({ method: "POST" })
  .validator(parseStrict(bulkAddPostsToPlaylistInputSchema))
  .handler(
    createEndpointHandler({
      service: PlaylistsService,
      operation: "bulkAddPosts",
      layer: PlaylistsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const bulkRemovePostsFromPlaylist = createServerFn({ method: "POST" })
  .validator(parseStrict(bulkRemovePostsFromPlaylistInputSchema))
  .handler(
    createEndpointHandler({
      service: PlaylistsService,
      operation: "bulkRemovePosts",
      layer: PlaylistsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const reorderPlaylistPosts = createServerFn({ method: "POST" })
  .validator(parseStrict(reorderPlaylistPostsInputSchema))
  .handler(
    createEndpointHandler({
      service: PlaylistsService,
      operation: "reorder",
      layer: PlaylistsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const fetchUserPlaylists = createServerFn({
  strict: { output: false },
})
  .validator(parse(Schema.String))
  .handler(
    createEndpointHandler({
      service: PlaylistsService,
      operation: "fetchUserPlaylists",
      layer: PlaylistsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const fetchPublicPlaylists = createServerFn({
  strict: { output: false },
})
  .validator(parseStrict(fetchPublicPlaylistsSchema))
  .handler(
    createEndpointHandler({
      service: PlaylistsService,
      operation: "fetchPublicPlaylists",
      layer: PlaylistsServiceLive,
      base: baseLayerFactories.db,
    }),
  );

export const fetchPlaylistDetail = createServerFn({
  strict: { output: false },
})
  .validator(parseStrict(fetchPlaylistDetailSchema))
  .handler(
    createEndpointHandler({
      service: PlaylistsService,
      operation: "fetchDetail",
      layer: PlaylistsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const fetchPlaylistsForPost = createServerFn({
  strict: { output: false },
})
  .validator(parse(Schema.Number))
  .handler(
    createEndpointHandler({
      service: PlaylistsService,
      operation: "fetchForPost",
      layer: PlaylistsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );
