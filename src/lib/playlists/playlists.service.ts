import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer, Option } from "effect";
import { z } from "zod";

import { getSessionEffect } from "../auth/auth.middleware";
import { KyselyDB } from "../db/context";
import {
  ForbiddenError,
  PlaylistNotFoundError,
  PostAlreadyInPlaylistError,
  PostNotFoundError,
  UnauthorizedError,
} from "../errors";
import {
  computePagination,
  type PaginationMeta,
} from "../pagination/pagination";
import {
  addPostToPlaylistInputSchema,
  createPlaylistInputSchema,
  fetchPlaylistDetailSchema,
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
  thumbnail_key: string | null;
  created_at: Date | null;
  user_id: string | null;
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

export class PlaylistsService extends Context.Service<
  PlaylistsService,
  {
    readonly create: (
      data: z.infer<typeof createPlaylistInputSchema>,
    ) => Effect.Effect<PlaylistRow, Error>;
    readonly update: (
      data: z.infer<typeof updatePlaylistInputSchema>,
    ) => Effect.Effect<PlaylistRow, Error>;
    readonly delete_: (
      playlistId: number,
    ) => Effect.Effect<{ success: boolean }, Error>;
    readonly addPost: (
      data: z.infer<typeof addPostToPlaylistInputSchema>,
    ) => Effect.Effect<
      { playlist_id: number; post_id: number; position: number },
      Error
    >;
    readonly removePost: (
      data: z.infer<typeof removePostFromPlaylistInputSchema>,
    ) => Effect.Effect<{ success: boolean }, Error>;
    readonly reorder: (
      data: z.infer<typeof reorderPlaylistPostsInputSchema>,
    ) => Effect.Effect<{ success: boolean }, Error>;
    readonly fetchUserPlaylists: (
      userId: string,
    ) => Effect.Effect<readonly PlaylistWithMeta[], Error>;
    readonly fetchDetail: (
      data: z.infer<typeof fetchPlaylistDetailSchema>,
    ) => Effect.Effect<PlaylistDetailResult, Error>;
    readonly fetchForPost: (
      postId: number,
    ) => Effect.Effect<readonly PlaylistForPostCheck[], Error>;
  }
>()("PlaylistsService") {}

export const PlaylistsServiceLive = Layer.effect(
  PlaylistsService,
  Effect.gen(function* () {
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
      data: z.infer<typeof createPlaylistInputSchema>,
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
      data: z.infer<typeof updatePlaylistInputSchema>,
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
      data: z.infer<typeof addPostToPlaylistInputSchema>,
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

      const existing = yield* db.executeTakeFirstOption(
        db
          .selectFrom("playlist_posts")
          .selectAll()
          .where("playlist_id", "=", data.playlistId)
          .where("post_id", "=", data.postId),
      );

      if (existing) {
        return yield* new PostAlreadyInPlaylistError({
          message: `Post ${data.postId} is already in playlist ${data.playlistId}`,
          playlistId: data.playlistId,
          postId: data.postId,
        });
      }

      const maxResults = yield* db.execute(
        db
          .selectFrom("playlist_posts")
          .select(db.fn.max("playlist_posts.position").as("max_pos"))
          .where("playlist_id", "=", data.playlistId),
      );
      const maxPos = maxResults[0]?.["max_pos" as keyof (typeof maxResults)[0]];
      const nextPosition = (maxPos != null ? Number(maxPos) : -1) + 1;

      const inserted = yield* db.executeTakeFirstOrError(
        db
          .insertInto("playlist_posts")
          .values({
            playlist_id: data.playlistId,
            position: nextPosition,
            post_id: data.postId,
          })
          .returningAll(),
      );

      return {
        playlist_id: inserted.playlist_id,
        post_id: inserted.post_id,
        position: inserted.position,
      };
    });

    const removePost = Effect.fn("PlaylistsService.removePost")(function* (
      data: z.infer<typeof removePostFromPlaylistInputSchema>,
    ) {
      const user = yield* requireAuth();
      yield* requirePlaylistOwnership(data.playlistId, user.id);

      yield* db.execute(
        db
          .deleteFrom("playlist_posts")
          .where("playlist_id", "=", data.playlistId)
          .where("post_id", "=", data.postId),
      );

      return { success: true };
    });

    const reorder = Effect.fn("PlaylistsService.reorder")(function* (
      data: z.infer<typeof reorderPlaylistPostsInputSchema>,
    ) {
      const user = yield* requireAuth();
      yield* requirePlaylistOwnership(data.playlistId, user.id);

      for (const item of data.items) {
        yield* db.execute(
          db
            .updateTable("playlist_posts")
            .set({ position: item.position })
            .where("playlist_id", "=", data.playlistId)
            .where("post_id", "=", item.postId),
        );
      }

      return { success: true };
    });

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

        const postCounts = yield* db.execute(
          db
            .selectFrom("playlist_posts")
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

        const thumbnailMap = new Map<number, string | null>();
        for (const p of playlists) {
          const firstPostOption = yield* db.executeTakeFirstOption(
            db
              .selectFrom("playlist_posts")
              .innerJoin("posts", "posts.id", "playlist_posts.post_id")
              .selectAll("posts")
              .where("playlist_posts.playlist_id", "=", p.id)
              .orderBy("playlist_posts.position", "asc")
              .limit(1),
          );
          const thumb = Option.match(firstPostOption, {
            onNone: () => null as string | null,
            onSome: (row) => row.thumbnailKey,
          });
          thumbnailMap.set(p.id, thumb);
        }

        return playlists.map((p) => ({
          ...p,
          post_count: countMap.get(p.id) ?? 0,
          thumbnail_key: thumbnailMap.get(p.id) ?? null,
        }));
      },
    );

    const fetchDetail = Effect.fn("PlaylistsService.fetchDetail")(function* (
      data: z.infer<typeof fetchPlaylistDetailSchema>,
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
          .selectAll()
          .where("playlist_id", "=", playlistId)
          .orderBy("position", "asc")
          .offset(pagination.offset)
          .limit(PAGE_SIZE),
      );

      const postIds = playlistPosts.map((pp) => pp.post_id);

      const posts =
        postIds.length > 0
          ? yield* db.execute(
              db.selectFrom("posts").selectAll().where("id", "in", postIds),
            )
          : [];

      const postMap = new Map(posts.map((p) => [p.id, p]));

      let thumbnailKey: string | null = null;

      const data_ = playlistPosts.map((pp): PlaylistPostRow | PostOrphan => {
        const post = postMap.get(pp.post_id);

        if (!post) {
          return {
            orphan: true,
            post_id: pp.post_id,
            position: pp.position,
            added_at: pp.created_at,
          };
        }

        if (thumbnailKey === null) {
          thumbnailKey = post.thumbnailKey;
        }

        return {
          post_id: pp.post_id,
          position: pp.position,
          added_at: pp.created_at,
          id: post.id,
          title: post.title,
          thumbnail_key: post.thumbnailKey,
          created_at: post.createdAt,
          user_id: post.userId,
          video_key: post.videoKey,
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
      reorder,
      fetchUserPlaylists,
      fetchDetail,
      fetchForPost,
    } as unknown as PlaylistsService["Service"];
  }),
);

export const createPlaylistEffect = Effect.fn("createPlaylist")(function* (
  data: z.infer<typeof createPlaylistInputSchema>,
) {
  const svc = yield* PlaylistsService;
  return yield* svc.create(data);
});

export const updatePlaylistEffect = Effect.fn("updatePlaylist")(function* (
  data: z.infer<typeof updatePlaylistInputSchema>,
) {
  const svc = yield* PlaylistsService;
  return yield* svc.update(data);
});

export const deletePlaylistEffect = Effect.fn("deletePlaylist")(function* (
  playlistId: number,
) {
  const svc = yield* PlaylistsService;
  return yield* svc.delete_(playlistId);
});

export const addPostToPlaylistEffect = Effect.fn("addPostToPlaylist")(
  function* (data: z.infer<typeof addPostToPlaylistInputSchema>) {
    const svc = yield* PlaylistsService;
    return yield* svc.addPost(data);
  },
);

export const removePostFromPlaylistEffect = Effect.fn("removePostFromPlaylist")(
  function* (data: z.infer<typeof removePostFromPlaylistInputSchema>) {
    const svc = yield* PlaylistsService;
    return yield* svc.removePost(data);
  },
);

export const reorderPlaylistPostsEffect = Effect.fn("reorderPlaylistPosts")(
  function* (data: z.infer<typeof reorderPlaylistPostsInputSchema>) {
    const svc = yield* PlaylistsService;
    return yield* svc.reorder(data);
  },
);

export const fetchUserPlaylistsEffect = Effect.fn("fetchUserPlaylists")(
  function* (userId: string) {
    const svc = yield* PlaylistsService;
    return yield* svc.fetchUserPlaylists(userId);
  },
);

export const fetchPlaylistDetailEffect = Effect.fn("fetchPlaylistDetail")(
  function* (data: z.infer<typeof fetchPlaylistDetailSchema>) {
    const svc = yield* PlaylistsService;
    return yield* svc.fetchDetail(data);
  },
);

export const fetchPlaylistsForPostEffect = Effect.fn("fetchPlaylistsForPost")(
  function* (postId: number) {
    const svc = yield* PlaylistsService;
    return yield* svc.fetchForPost(postId);
  },
);

export const createPlaylist = createServerFn({ method: "POST" })
  .validator((input: unknown) => createPlaylistInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { makeAuthLayer } = await import("../db/layer-factories.server");
    const base = await makeAuthLayer();
    const layer = PlaylistsServiceLive.pipe(Layer.provideMerge(base));
    return Effect.runPromise(
      createPlaylistEffect(data).pipe(
        Effect.provide(layer),
        Effect.tapError((error) =>
          Effect.logError("Server function failed").pipe(
            Effect.annotateLogs({ error }),
          ),
        ),
      ),
    );
  });

export const updatePlaylist = createServerFn({ method: "POST" })
  .validator((input: unknown) => updatePlaylistInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { makeAuthLayer } = await import("../db/layer-factories.server");
    const base = await makeAuthLayer();
    const layer = PlaylistsServiceLive.pipe(Layer.provideMerge(base));
    return Effect.runPromise(
      updatePlaylistEffect(data).pipe(
        Effect.provide(layer),
        Effect.tapError((error) =>
          Effect.logError("Server function failed").pipe(
            Effect.annotateLogs({ error }),
          ),
        ),
      ),
    );
  });

export const deletePlaylist = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ playlistId: z.number() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { makeAuthLayer } = await import("../db/layer-factories.server");
    const base = await makeAuthLayer();
    const layer = PlaylistsServiceLive.pipe(Layer.provideMerge(base));
    return Effect.runPromise(
      deletePlaylistEffect(data.playlistId).pipe(
        Effect.provide(layer),
        Effect.tapError((error) =>
          Effect.logError("Server function failed").pipe(
            Effect.annotateLogs({ error }),
          ),
        ),
      ),
    );
  });

export const addPostToPlaylist = createServerFn({ method: "POST" })
  .validator((input: unknown) => addPostToPlaylistInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { makeAuthLayer } = await import("../db/layer-factories.server");
    const base = await makeAuthLayer();
    const layer = PlaylistsServiceLive.pipe(Layer.provideMerge(base));
    return Effect.runPromise(
      addPostToPlaylistEffect(data).pipe(
        Effect.provide(layer),
        Effect.tapError((error) =>
          Effect.logError("Server function failed").pipe(
            Effect.annotateLogs({ error }),
          ),
        ),
      ),
    );
  });

export const removePostFromPlaylist = createServerFn({ method: "POST" })
  .validator((input: unknown) => removePostFromPlaylistInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { makeAuthLayer } = await import("../db/layer-factories.server");
    const base = await makeAuthLayer();
    const layer = PlaylistsServiceLive.pipe(Layer.provideMerge(base));
    return Effect.runPromise(
      removePostFromPlaylistEffect(data).pipe(
        Effect.provide(layer),
        Effect.tapError((error) =>
          Effect.logError("Server function failed").pipe(
            Effect.annotateLogs({ error }),
          ),
        ),
      ),
    );
  });

export const reorderPlaylistPosts = createServerFn({ method: "POST" })
  .validator((input: unknown) => reorderPlaylistPostsInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { makeAuthLayer } = await import("../db/layer-factories.server");
    const base = await makeAuthLayer();
    const layer = PlaylistsServiceLive.pipe(Layer.provideMerge(base));
    return Effect.runPromise(
      reorderPlaylistPostsEffect(data).pipe(
        Effect.provide(layer),
        Effect.tapError((error) =>
          Effect.logError("Server function failed").pipe(
            Effect.annotateLogs({ error }),
          ),
        ),
      ),
    );
  });

export const fetchUserPlaylists = createServerFn({
  strict: { output: false },
})
  .validator((input: unknown) => z.string().parse(input))
  .handler(async ({ data }) => {
    const { makeDBLayer } = await import("../db/layer-factories.server");
    const base = await makeDBLayer();
    const layer = PlaylistsServiceLive.pipe(Layer.provideMerge(base));
    return Effect.runPromise(
      fetchUserPlaylistsEffect(data).pipe(
        Effect.provide(layer),
        Effect.tapError((error) =>
          Effect.logError("Server function failed").pipe(
            Effect.annotateLogs({ error }),
          ),
        ),
      ),
    );
  });

export const fetchPlaylistDetail = createServerFn({
  strict: { output: false },
})
  .validator((input: unknown) => fetchPlaylistDetailSchema.parse(input))
  .handler(async ({ data }) => {
    const { makeDBLayer } = await import("../db/layer-factories.server");
    const base = await makeDBLayer();
    const layer = PlaylistsServiceLive.pipe(Layer.provideMerge(base));
    return Effect.runPromise(
      fetchPlaylistDetailEffect(data).pipe(
        Effect.provide(layer),
        Effect.tapError((error) =>
          Effect.logError("Server function failed").pipe(
            Effect.annotateLogs({ error }),
          ),
        ),
      ),
    );
  });

export const fetchPlaylistsForPost = createServerFn({
  strict: { output: false },
})
  .validator((input: unknown) => z.number().parse(input))
  .handler(async ({ data }) => {
    const { makeAuthLayer } = await import("../db/layer-factories.server");
    const base = await makeAuthLayer();
    const layer = PlaylistsServiceLive.pipe(Layer.provideMerge(base));
    return Effect.runPromise(
      fetchPlaylistsForPostEffect(data).pipe(
        Effect.provide(layer),
        Effect.tapError((error) =>
          Effect.logError("Server function failed").pipe(
            Effect.annotateLogs({ error }),
          ),
        ),
      ),
    );
  });
