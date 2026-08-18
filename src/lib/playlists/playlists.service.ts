import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer, Option, Schema } from "effect";

import type { AuthServices } from "../auth/context";
import { getSessionEffect, SessionFetchError } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { SqlError, SqlNoFirstResult } from "../effect/effect.utils";
import { parse, parseStrict } from "../effect/schema.utils";
import {
  ForbiddenError,
  PlaylistNotFoundError,
  PostAlreadyInPlaylistError,
  PostNotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../errors";
import {
  computePagination,
  type PaginationMeta,
} from "../pagination/pagination";
import { baseLayerFactories, createHandler } from "../server-fn.handler";
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
  created_at: Date;
  updated_at: Date;
};

type PlaylistWithMeta = {
  id: number;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
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
  created_at: Date;
  updated_at: Date;
  contains_post: boolean;
};

type PlaylistPostRow = {
  post_id: number;
  position: number;
  added_at: Date;
  id: number | null;
  title: string | null;
  content: string | null;
  thumbnail_key: string | null;
  created_at: Date | null;
  user_id: string | null;
  user_name: string | null;
  video_key: string | null;
};

type PostOrphan = {
  orphan: true;
  post_id: number;
  position: number;
  added_at: Date;
};

type PlaylistDetailResult = {
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
      UnauthorizedError | SessionFetchError | SqlError | SqlNoFirstResult,
      AuthServices
    >;
    readonly update: (
      data: Schema.Schema.Type<typeof updatePlaylistInputSchema>,
    ) => Effect.Effect<
      PlaylistRow,
      | UnauthorizedError
      | ForbiddenError
      | PlaylistNotFoundError
      | SessionFetchError
      | SqlError
      | SqlNoFirstResult,
      AuthServices
    >;
    readonly delete_: (
      playlistId: number,
    ) => Effect.Effect<
      { success: boolean },
      | UnauthorizedError
      | ForbiddenError
      | PlaylistNotFoundError
      | SessionFetchError
      | SqlError,
      AuthServices
    >;
    readonly addPost: (
      data: Schema.Schema.Type<typeof addPostToPlaylistInputSchema>,
    ) => Effect.Effect<
      { playlist_id: number; post_id: number; position: number },
      | UnauthorizedError
      | ForbiddenError
      | PlaylistNotFoundError
      | PostNotFoundError
      | PostAlreadyInPlaylistError
      | SessionFetchError
      | SqlError
      | SqlNoFirstResult,
      AuthServices
    >;
    readonly removePost: (
      data: Schema.Schema.Type<typeof removePostFromPlaylistInputSchema>,
    ) => Effect.Effect<
      { success: boolean },
      | UnauthorizedError
      | ForbiddenError
      | PlaylistNotFoundError
      | SessionFetchError
      | SqlError,
      AuthServices
    >;
    readonly bulkAddPosts: (
      data: Schema.Schema.Type<typeof bulkAddPostsToPlaylistInputSchema>,
    ) => Effect.Effect<
      BulkAddPostsResult,
      | UnauthorizedError
      | ForbiddenError
      | PlaylistNotFoundError
      | SessionFetchError
      | SqlError
      | SqlNoFirstResult,
      AuthServices
    >;
    readonly bulkRemovePosts: (
      data: Schema.Schema.Type<typeof bulkRemovePostsFromPlaylistInputSchema>,
    ) => Effect.Effect<
      BulkRemovePostsResult,
      | UnauthorizedError
      | ForbiddenError
      | PlaylistNotFoundError
      | SessionFetchError
      | SqlError,
      AuthServices
    >;
    readonly reorder: (
      data: Schema.Schema.Type<typeof reorderPlaylistPostsInputSchema>,
    ) => Effect.Effect<
      { success: boolean },
      | UnauthorizedError
      | ForbiddenError
      | PlaylistNotFoundError
      | SessionFetchError
      | SqlError
      | ValidationError,
      AuthServices
    >;
    readonly fetchUserPlaylists: (
      userId: string,
    ) => Effect.Effect<
      readonly PlaylistWithMeta[],
      SessionFetchError | SqlError,
      AuthServices
    >;
    readonly fetchPublicPlaylists: (
      data: Schema.Schema.Type<typeof fetchPublicPlaylistsSchema>,
    ) => Effect.Effect<PublicPlaylistsResult, SqlError>;
    readonly fetchDetail: (
      data: Schema.Schema.Type<typeof fetchPlaylistDetailSchema>,
    ) => Effect.Effect<
      PlaylistDetailResult,
      PlaylistNotFoundError | SessionFetchError | SqlError | SqlNoFirstResult,
      AuthServices
    >;
    readonly fetchForPost: (
      postId: number,
    ) => Effect.Effect<
      readonly PlaylistForPostCheck[],
      UnauthorizedError | SessionFetchError | SqlError,
      AuthServices
    >;
  }
>()("PlaylistsService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;

    const requireAuth = Effect.fn("PlaylistsService.requireAuth")(function* () {
      const session = yield* getSessionEffect();

      if (!session?.user) {
        return yield* new UnauthorizedError({
          message: "You must be logged in",
        });
      }

      return session.user;
    });

    const requirePlaylistOwnership = Effect.fn(
      "PlaylistsService.requirePlaylistOwnership",
    )(function* (playlistId: number, userId: string) {
      const playlistOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("playlists")
          .select(["id", "user_id"])
          .where("id", "=", playlistId),
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

      if (playlist.user_id !== userId) {
        return yield* new ForbiddenError({
          message: "You can only modify your own playlists",
        });
      }

      return playlist;
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

      return playlist;
    });

    const update = Effect.fn("PlaylistsService.update")(function* (
      data: Schema.Schema.Type<typeof updatePlaylistInputSchema>,
    ) {
      const user = yield* requireAuth();
      yield* requirePlaylistOwnership(data.playlistId, user.id);

      const setValues: Record<string, unknown> = {
        updated_at: new Date(),
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

      return updated;
    });

    const delete_ = Effect.fn("PlaylistsService.delete_")(function* (
      playlistId: number,
    ) {
      const user = yield* requireAuth();
      yield* requirePlaylistOwnership(playlistId, user.id);

      yield* db.execute(
        db.deleteFrom("playlists").where("id", "=", playlistId),
      );

      return { success: true };
    });

    const addPost = Effect.fn("PlaylistsService.addPost")(function* (
      data: Schema.Schema.Type<typeof addPostToPlaylistInputSchema>,
    ) {
      const user = yield* requireAuth();
      yield* requirePlaylistOwnership(data.playlistId, user.id);

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

      const inserted = yield* db.transaction().execute((trx) =>
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

          const maxResults = yield* trx.execute(
            trx
              .selectFrom("playlist_posts")
              .select(trx.fn.max("playlist_posts.position").as("max_pos"))
              .where("playlist_id", "=", data.playlistId),
          );
          const maxPos =
            maxResults[0]?.["max_pos" as keyof (typeof maxResults)[0]];
          const nextPosition = (maxPos != null ? Number(maxPos) : -1) + 1;

          return yield* trx.executeTakeFirstOrError(
            trx
              .insertInto("playlist_posts")
              .values({
                playlist_id: data.playlistId,
                position: nextPosition,
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
      const user = yield* requireAuth();
      yield* requirePlaylistOwnership(data.playlistId, user.id);

      yield* db.transaction().execute((trx) =>
        Effect.gen(function* () {
          yield* trx.execute(
            trx
              .deleteFrom("playlist_posts")
              .where("playlist_id", "=", data.playlistId)
              .where("post_id", "=", data.postId),
          );

          const remaining = yield* trx.execute(
            trx
              .selectFrom("playlist_posts")
              .select(["post_id"])
              .where("playlist_id", "=", data.playlistId)
              .orderBy("position", "asc")
              .orderBy("created_at", "asc"),
          );

          let position = 0;
          for (const row of remaining) {
            yield* trx.execute(
              trx
                .updateTable("playlist_posts")
                .set({ position })
                .where("playlist_id", "=", data.playlistId)
                .where("post_id", "=", row.post_id),
            );
            position++;
          }
        }),
      );

      return { success: true };
    });

    const bulkAddPosts = Effect.fn("PlaylistsService.bulkAddPosts")(function* (
      data: Schema.Schema.Type<typeof bulkAddPostsToPlaylistInputSchema>,
    ) {
      const user = yield* requireAuth();
      yield* requirePlaylistOwnership(data.playlistId, user.id);

      const uniqueIds = [...new Set(data.postIds)];

      return yield* db.transaction().execute((trx) =>
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
            const maxResults = yield* trx.execute(
              trx
                .selectFrom("playlist_posts")
                .select(trx.fn.max("playlist_posts.position").as("max_pos"))
                .where("playlist_id", "=", data.playlistId),
            );
            const maxPos = maxResults[0]?.max_pos;
            let position = (maxPos != null ? Number(maxPos) : -1) + 1;

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
        const user = yield* requireAuth();
        yield* requirePlaylistOwnership(data.playlistId, user.id);

        const uniqueIds = [...new Set(data.postIds)];

        return yield* db.transaction().execute((trx) =>
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

              const remaining = yield* trx.execute(
                trx
                  .selectFrom("playlist_posts")
                  .select(["post_id"])
                  .where("playlist_id", "=", data.playlistId)
                  .orderBy("position", "asc")
                  .orderBy("created_at", "asc"),
              );

              let position = 0;
              for (const row of remaining) {
                yield* trx.execute(
                  trx
                    .updateTable("playlist_posts")
                    .set({ position })
                    .where("playlist_id", "=", data.playlistId)
                    .where("post_id", "=", row.post_id),
                );
                position++;
              }
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
      const user = yield* requireAuth();
      yield* requirePlaylistOwnership(data.playlistId, user.id);

      const currentPostIds = yield* db.execute(
        db
          .selectFrom("playlist_posts")
          .select(["post_id"])
          .where("playlist_id", "=", data.playlistId),
      );

      const currentSet = new Set(currentPostIds.map((row) => row.post_id));
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

      yield* db.transaction().execute((trx) =>
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
        const session = yield* getSessionEffect();
        const isOwner = session?.user?.id === userId;

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
        created_at: p.created_at,
        description: p.description,
        id: p.id,
        is_public: p.is_public,
        post_count: countMap.get(p.id) ?? 0,
        thumbnail_key: thumbnailMap.get(p.id) ?? null,
        title: p.title,
        updated_at: p.updated_at,
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
      const session = yield* getSessionEffect();
      const currentUserId = session?.user?.id;

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
            "posts.content",
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

      let thumbnailKey: string | null = null;

      const data_ = playlistPosts.map((pp): PlaylistPostRow | PostOrphan => {
        if (pp.id === null) {
          return {
            orphan: true,
            post_id: pp.post_id,
            position: pp.position,
            added_at: pp.added_at,
          };
        }

        if (thumbnailKey === null && pp.thumbnail_key !== null) {
          thumbnailKey = pp.thumbnail_key;
        }

        return {
          post_id: pp.post_id,
          position: pp.position,
          added_at: pp.added_at,
          id: pp.id,
          title: pp.title,
          content: pp.content,
          thumbnail_key: pp.thumbnail_key,
          created_at: pp.created_at,
          user_id: pp.user_id,
          user_name: pp.user_name,
          video_key: pp.video_key,
        };
      });

      const playlistMeta: PlaylistWithMeta = {
        ...playlist,
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
      postId: number,
    ) {
      const user = yield* requireAuth();

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
}) {
  static readonly create = Effect.fn("PlaylistsService.create")(function* (
    data: Schema.Schema.Type<typeof createPlaylistInputSchema>,
  ) {
    const svc = yield* PlaylistsService;
    return yield* svc.create(data);
  });

  static readonly update = Effect.fn("PlaylistsService.update")(function* (
    data: Schema.Schema.Type<typeof updatePlaylistInputSchema>,
  ) {
    const svc = yield* PlaylistsService;
    return yield* svc.update(data);
  });

  static readonly delete_ = Effect.fn("PlaylistsService.delete_")(function* (
    playlistId: number,
  ) {
    const svc = yield* PlaylistsService;
    return yield* svc.delete_(playlistId);
  });

  static readonly addPost = Effect.fn("PlaylistsService.addPost")(function* (
    data: Schema.Schema.Type<typeof addPostToPlaylistInputSchema>,
  ) {
    const svc = yield* PlaylistsService;
    return yield* svc.addPost(data);
  });

  static readonly removePost = Effect.fn("PlaylistsService.removePost")(
    function* (
      data: Schema.Schema.Type<typeof removePostFromPlaylistInputSchema>,
    ) {
      const svc = yield* PlaylistsService;
      return yield* svc.removePost(data);
    },
  );

  static readonly bulkAddPosts = Effect.fn("PlaylistsService.bulkAddPosts")(
    function* (
      data: Schema.Schema.Type<typeof bulkAddPostsToPlaylistInputSchema>,
    ) {
      const svc = yield* PlaylistsService;
      return yield* svc.bulkAddPosts(data);
    },
  );

  static readonly bulkRemovePosts = Effect.fn(
    "PlaylistsService.bulkRemovePosts",
  )(function* (
    data: Schema.Schema.Type<typeof bulkRemovePostsFromPlaylistInputSchema>,
  ) {
    const svc = yield* PlaylistsService;
    return yield* svc.bulkRemovePosts(data);
  });

  static readonly reorder = Effect.fn("PlaylistsService.reorder")(function* (
    data: Schema.Schema.Type<typeof reorderPlaylistPostsInputSchema>,
  ) {
    const svc = yield* PlaylistsService;
    return yield* svc.reorder(data);
  });

  static readonly fetchUserPlaylists = Effect.fn(
    "PlaylistsService.fetchUserPlaylists",
  )(function* (userId: string) {
    const svc = yield* PlaylistsService;
    return yield* svc.fetchUserPlaylists(userId);
  });

  static readonly fetchPublicPlaylists = Effect.fn(
    "PlaylistsService.fetchPublicPlaylists",
  )(function* (data: Schema.Schema.Type<typeof fetchPublicPlaylistsSchema>) {
    const svc = yield* PlaylistsService;
    return yield* svc.fetchPublicPlaylists(data);
  });

  static readonly fetchDetail = Effect.fn("PlaylistsService.fetchDetail")(
    function* (data: Schema.Schema.Type<typeof fetchPlaylistDetailSchema>) {
      const svc = yield* PlaylistsService;
      return yield* svc.fetchDetail(data);
    },
  );

  static readonly fetchForPost = Effect.fn("PlaylistsService.fetchForPost")(
    function* (postId: number) {
      const svc = yield* PlaylistsService;
      return yield* svc.fetchForPost(postId);
    },
  );
}

export const PlaylistsServiceLive = Layer.effect(
  PlaylistsService,
  PlaylistsService.make,
);

export const createPlaylist = createServerFn({ method: "POST" })
  .validator((input: unknown) => parseStrict(createPlaylistInputSchema)(input))
  .handler(
    createHandler(
      PlaylistsService.create,
      PlaylistsServiceLive,
      baseLayerFactories.auth,
    ),
  );

export const updatePlaylist = createServerFn({ method: "POST" })
  .validator((input: unknown) => parseStrict(updatePlaylistInputSchema)(input))
  .handler(
    createHandler(
      PlaylistsService.update,
      PlaylistsServiceLive,
      baseLayerFactories.auth,
    ),
  );

export const deletePlaylist = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(Schema.Struct({ playlistId: Schema.Number }))(input),
  )
  .handler(
    createHandler(
      (data: { playlistId: number }) =>
        PlaylistsService.delete_(data.playlistId),
      PlaylistsServiceLive,
      baseLayerFactories.auth,
    ),
  );

export const addPostToPlaylist = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parseStrict(addPostToPlaylistInputSchema)(input),
  )
  .handler(
    createHandler(
      PlaylistsService.addPost,
      PlaylistsServiceLive,
      baseLayerFactories.auth,
    ),
  );

export const removePostFromPlaylist = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parseStrict(removePostFromPlaylistInputSchema)(input),
  )
  .handler(
    createHandler(
      PlaylistsService.removePost,
      PlaylistsServiceLive,
      baseLayerFactories.auth,
    ),
  );

export const bulkAddPostsToPlaylist = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parseStrict(bulkAddPostsToPlaylistInputSchema)(input),
  )
  .handler(
    createHandler(
      PlaylistsService.bulkAddPosts,
      PlaylistsServiceLive,
      baseLayerFactories.auth,
    ),
  );

export const bulkRemovePostsFromPlaylist = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parseStrict(bulkRemovePostsFromPlaylistInputSchema)(input),
  )
  .handler(
    createHandler(
      PlaylistsService.bulkRemovePosts,
      PlaylistsServiceLive,
      baseLayerFactories.auth,
    ),
  );

export const reorderPlaylistPosts = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parseStrict(reorderPlaylistPostsInputSchema)(input),
  )
  .handler(
    createHandler(
      PlaylistsService.reorder,
      PlaylistsServiceLive,
      baseLayerFactories.auth,
    ),
  );

export const fetchUserPlaylists = createServerFn({
  strict: { output: false },
})
  .validator((input: unknown) => parse(Schema.String)(input))
  .handler(
    createHandler(
      (data: string) => PlaylistsService.fetchUserPlaylists(data),
      PlaylistsServiceLive,
      baseLayerFactories.auth,
    ),
  );

export const fetchPublicPlaylists = createServerFn({
  strict: { output: false },
})
  .validator((input: unknown) => parseStrict(fetchPublicPlaylistsSchema)(input))
  .handler(
    createHandler(
      PlaylistsService.fetchPublicPlaylists,
      PlaylistsServiceLive,
      baseLayerFactories.db,
    ),
  );

export const fetchPlaylistDetail = createServerFn({
  strict: { output: false },
})
  .validator((input: unknown) => parseStrict(fetchPlaylistDetailSchema)(input))
  .handler(
    createHandler(
      PlaylistsService.fetchDetail,
      PlaylistsServiceLive,
      baseLayerFactories.auth,
    ),
  );

export const fetchPlaylistsForPost = createServerFn({
  strict: { output: false },
})
  .validator((input: unknown) => parse(Schema.Number)(input))
  .handler(
    createHandler(
      (data: number) => PlaylistsService.fetchForPost(data),
      PlaylistsServiceLive,
      baseLayerFactories.auth,
    ),
  );
