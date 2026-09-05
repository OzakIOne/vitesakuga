import { sql, type Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeAuthSession } from "../auth/session.fixture";
import type { DB } from "../db/kysely";
import {
  makeServiceTestLayer,
  type ServiceTestContext,
} from "../db/test-utils";
import { safeParseStrict } from "../effect/schema.utils";
import type { PlaylistId, PostId } from "../ids";
import { asPlaylistId, asPostId } from "../ids";
import { bulkAddPostsToPlaylistInputSchema } from "./playlists.schema";
import { PlaylistsService, PlaylistsServiceLive } from "./playlists.service";

let db: Kysely<DB>;
let runEffect: ServiceTestContext["runEffect"];
let runFailure: ServiceTestContext["runFailure"];
let mockGetSession: ReturnType<typeof vi.fn>;
let closeCtx: () => Promise<void>;

const testUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@test.com",
  image: null,
  username: "alice",
};

const testUser2 = {
  id: "user-2",
  name: "Bob",
  email: "bob@test.com",
  image: null,
  username: "bob",
};

let postId: PostId;
let postId2: PostId;

const insertPost = async (
  overrides: Partial<{
    title: string;
    userId: string;
    videoKey: string;
    thumbnailKey: string;
  }> = {},
) => {
  const defaults = {
    title: "Test Post",
    description: "Content",
    userId: "user-1",
    videoKey: "videos/abc.mp4",
    thumbnailKey: "thumbnails/abc.jpg",
    videoMetadata: "{}",
  };
  const row = { ...defaults, ...overrides };
  const result = await db
    .insertInto("posts")
    .values(row)
    .returning("id")
    .executeTakeFirstOrThrow();
  // SAFETY: posts.id is the table's primary key.
  return asPostId(result.id);
};

beforeEach(async () => {
  const ctx = await makeServiceTestLayer(PlaylistsServiceLive);
  db = ctx.db;
  runEffect = ctx.runEffect;
  runFailure = ctx.runFailure;
  mockGetSession = ctx.mockGetSession;
  closeCtx = ctx.close;

  await db.insertInto("user").values(testUser).execute();
  await db.insertInto("user").values(testUser2).execute();

  await db.deleteFrom("playlist_posts").execute();
  await db.deleteFrom("playlists").execute();

  postId = asPostId(await insertPost());
  postId2 = await insertPost({
    title: "Second Post",
    videoKey: "videos/def.mp4",
    thumbnailKey: "thumbnails/def.jpg",
  });
});

afterEach(() => closeCtx());

describe(PlaylistsService.create, () => {
  it("creates a playlist for the authenticated user", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.create({
        title: "My Favs",
        description: "Best sakuga",
        isPublic: false,
      }),
    );

    expect(result.title).toBe("My Favs");
    expect(result.description).toBe("Best sakuga");
    expect(result.is_public).toBe(false);
    expect(result.user_id).toBe("user-1");

    const playlists = await db.selectFrom("playlists").selectAll().execute();
    expect(playlists).toHaveLength(1);
  });

  it("defaults isPublic to false", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.create({ title: "Private", isPublic: false }),
    );

    expect(result.is_public).toBe(false);
  });

  it("throws unauthorized when not logged in", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const error = await runFailure(
      PlaylistsService.create({ title: "Nope", isPublic: false }),
    );
    expect(error).toMatchObject({
      _tag: "UnauthorizedError",
      message: "You must be logged in",
    });
  });
});

describe(PlaylistsService.update, () => {
  let playlistId: PlaylistId;

  beforeEach(async () => {
    const row = await db
      .insertInto("playlists")
      .values({
        title: "Original",
        description: "Old desc",
        is_public: false,
        user_id: "user-1",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    playlistId = asPlaylistId(row.id);
  });

  it("updates title and description", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.update({
        playlistId,
        title: "Updated",
        description: "New desc",
      }),
    );

    expect(result.title).toBe("Updated");
    expect(result.description).toBe("New desc");

    const updated = await db
      .selectFrom("playlists")
      .selectAll()
      .where("id", "=", playlistId)
      .executeTakeFirstOrThrow();
    expect(updated.title).toBe("Updated");
  });

  it("toggles visibility", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.update({ playlistId, isPublic: true }),
    );

    expect(result.is_public).toBe(true);
  });

  it("throws unauthorized when not logged in", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const error = await runFailure(
      PlaylistsService.update({ playlistId, title: "Hack" }),
    );
    expect(error).toMatchObject({
      _tag: "UnauthorizedError",
      message: "You must be logged in",
    });
  });

  it("throws forbidden when not the owner", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser2));

    const error = await runFailure(
      PlaylistsService.update({ playlistId, title: "Hack" }),
    );
    expect(error._tag).toBe("ForbiddenError");
  });

  it("throws not found for non-existent playlist", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const error = await runFailure(
      PlaylistsService.update({ playlistId: asPlaylistId(9999), title: "X" }),
    );
    expect(error).toMatchObject({
      _tag: "PlaylistNotFoundError",
      playlistId: 9999,
    });
  });
});

describe(PlaylistsService.delete_, () => {
  let playlistId: PlaylistId;

  beforeEach(async () => {
    const row = await db
      .insertInto("playlists")
      .values({
        title: "To Delete",
        is_public: false,
        user_id: "user-1",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    playlistId = asPlaylistId(row.id);
  });

  it("deletes the playlist", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(PlaylistsService.delete_(playlistId));

    expect(result).toEqual({ success: true });

    const remaining = await db
      .selectFrom("playlists")
      .selectAll()
      .where("id", "=", playlistId)
      .execute();
    expect(remaining).toHaveLength(0);
  });

  it("cascades delete to playlist_posts", async () => {
    await db
      .insertInto("playlist_posts")
      .values({ playlist_id: playlistId, post_id: postId, position: 0 })
      .execute();

    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    await runEffect(PlaylistsService.delete_(playlistId));

    const remainingPosts = await db
      .selectFrom("playlist_posts")
      .selectAll()
      .execute();
    expect(remainingPosts).toHaveLength(0);
  });

  it("throws forbidden when not the owner", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser2));

    const error = await runFailure(PlaylistsService.delete_(playlistId));
    expect(error._tag).toBe("ForbiddenError");
  });
});

describe(PlaylistsService.addPost, () => {
  let playlistId: PlaylistId;

  beforeEach(async () => {
    await db.deleteFrom("playlist_posts").execute();

    const row = await db
      .insertInto("playlists")
      .values({
        title: "My Playlist",
        is_public: false,
        user_id: "user-1",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    playlistId = asPlaylistId(row.id);
  });

  it("adds a post to the playlist", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.addPost({ playlistId, postId }),
    );

    expect(result.playlist_id).toBe(playlistId);
    expect(result.post_id).toBe(postId);
    expect(result.position).toBe(0);

    const entries = await db.selectFrom("playlist_posts").selectAll().execute();
    expect(entries).toHaveLength(1);
  });

  it("increments position for subsequent posts", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    await runEffect(PlaylistsService.addPost({ playlistId, postId }));

    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.addPost({ playlistId, postId: postId2 }),
    );

    expect(result.position).toBe(1);
  });

  it("throws when adding a duplicate post", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));
    await runEffect(PlaylistsService.addPost({ playlistId, postId }));

    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const error = await runFailure(
      PlaylistsService.addPost({ playlistId, postId }),
    );
    expect(error).toMatchObject({
      _tag: "PostAlreadyInPlaylistError",
      playlistId,
      postId,
    });
  });

  it("throws when post does not exist", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const error = await runFailure(
      PlaylistsService.addPost({ playlistId, postId: asPostId(9999) }),
    );
    expect(error).toMatchObject({ _tag: "PostNotFoundError", postId: 9999 });
  });

  it("throws forbidden when not the playlist owner", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser2));

    const error = await runFailure(
      PlaylistsService.addPost({ playlistId, postId }),
    );
    expect(error._tag).toBe("ForbiddenError");
  });
});

describe(PlaylistsService.removePost, () => {
  let playlistId: PlaylistId;

  beforeEach(async () => {
    const row = await db
      .insertInto("playlists")
      .values({
        title: "My Playlist",
        is_public: false,
        user_id: "user-1",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    playlistId = asPlaylistId(row.id);

    await db
      .insertInto("playlist_posts")
      .values({ playlist_id: playlistId, post_id: postId, position: 0 })
      .execute();
  });

  it("removes a post from the playlist", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.removePost({ playlistId, postId }),
    );

    expect(result).toEqual({ success: true });

    const entries = await db.selectFrom("playlist_posts").selectAll().execute();
    expect(entries).toHaveLength(0);
  });

  it("does nothing when the post is not in playlist", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.removePost({
        playlistId,
        postId: postId2,
      }),
    );

    expect(result).toEqual({ success: true });
  });

  it("throws forbidden when not the playlist owner", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser2));

    const error = await runFailure(
      PlaylistsService.removePost({ playlistId, postId }),
    );
    expect(error._tag).toBe("ForbiddenError");
  });
});

describe(PlaylistsService.bulkAddPosts, () => {
  let playlistId: PlaylistId;

  beforeEach(async () => {
    await db.deleteFrom("playlist_posts").execute();

    const row = await db
      .insertInto("playlists")
      .values({
        title: "Bulk Add",
        is_public: false,
        user_id: "user-1",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    playlistId = asPlaylistId(row.id);
  });

  it("adds multiple posts at the end of the playlist", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.bulkAddPosts({
        playlistId,
        postIds: [postId, postId2],
      }),
    );

    expect(result).toEqual({
      added: 2,
      already_added: 0,
      not_found: 0,
      playlist_id: playlistId,
    });

    const entries = await db
      .selectFrom("playlist_posts")
      .selectAll()
      .orderBy("position", "asc")
      .execute();
    expect(entries).toHaveLength(2);
    expect(entries[0]!.post_id).toBe(postId);
    expect(entries[0]!.position).toBe(0);
    expect(entries[1]!.post_id).toBe(postId2);
    expect(entries[1]!.position).toBe(1);
  });

  it("appends after existing posts and reports already added", async () => {
    await db
      .insertInto("playlist_posts")
      .values({
        playlist_id: playlistId,
        post_id: postId,
        position: 0,
      })
      .execute();

    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.bulkAddPosts({
        playlistId,
        postIds: [postId, postId2],
      }),
    );

    expect(result.added).toBe(1);
    expect(result.already_added).toBe(1);
    expect(result.not_found).toBe(0);

    const entries = await db
      .selectFrom("playlist_posts")
      .selectAll()
      .orderBy("position", "asc")
      .execute();
    expect(entries).toHaveLength(2);
    expect(entries[1]!.post_id).toBe(postId2);
    expect(entries[1]!.position).toBe(1);
  });

  it("dedupes input and reports not found posts", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.bulkAddPosts({
        playlistId,
        postIds: [postId, postId, asPostId(9999)],
      }),
    );

    expect(result).toEqual({
      added: 1,
      already_added: 0,
      not_found: 1,
      playlist_id: playlistId,
    });
  });

  it("rejects an empty bulk at the schema boundary", () => {
    // `postIds` is a NonEmptyArray: an empty bulk never reaches the service
    // (whose SQL would emit an invalid `in ()`), so the validator is the
    // protection.
    const result = safeParseStrict(bulkAddPostsToPlaylistInputSchema)({
      playlistId,
      postIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("throws forbidden when not the owner", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser2));

    const error = await runFailure(
      PlaylistsService.bulkAddPosts({
        playlistId,
        postIds: [postId],
      }),
    );
    expect(error._tag).toBe("ForbiddenError");
  });
});

describe(PlaylistsService.bulkRemovePosts, () => {
  let playlistId: PlaylistId;

  beforeEach(async () => {
    await db.deleteFrom("playlist_posts").execute();

    const row = await db
      .insertInto("playlists")
      .values({
        title: "Bulk Remove",
        is_public: false,
        user_id: "user-1",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    playlistId = asPlaylistId(row.id);

    await db
      .insertInto("playlist_posts")
      .values({
        playlist_id: playlistId,
        post_id: postId,
        position: 0,
      })
      .execute();
    await db
      .insertInto("playlist_posts")
      .values({
        playlist_id: playlistId,
        post_id: postId2,
        position: 1,
      })
      .execute();
  });

  it("removes selected posts and renumbers the rest", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.bulkRemovePosts({
        playlistId,
        postIds: [postId],
      }),
    );

    expect(result).toEqual({ playlist_id: playlistId, removed: 1 });

    const entries = await db
      .selectFrom("playlist_posts")
      .selectAll()
      .orderBy("position", "asc")
      .execute();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.post_id).toBe(postId2);
    expect(entries[0]!.position).toBe(0);
  });

  it("returns removed 0 when none of the posts are in the playlist", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.bulkRemovePosts({
        playlistId,
        postIds: [asPostId(9999)],
      }),
    );

    expect(result).toEqual({ playlist_id: playlistId, removed: 0 });

    const entries = await db.selectFrom("playlist_posts").selectAll().execute();
    expect(entries).toHaveLength(2);
  });

  it("throws forbidden when not the owner", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser2));

    const error = await runFailure(
      PlaylistsService.bulkRemovePosts({
        playlistId,
        postIds: [postId],
      }),
    );
    expect(error._tag).toBe("ForbiddenError");
  });
});

describe(PlaylistsService.reorder, () => {
  let playlistId: PlaylistId;

  beforeEach(async () => {
    const row = await db
      .insertInto("playlists")
      .values({
        title: "Reorder",
        is_public: false,
        user_id: "user-1",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    playlistId = asPlaylistId(row.id);

    await db
      .insertInto("playlist_posts")
      .values({ playlist_id: playlistId, post_id: postId, position: 0 })
      .execute();
    await db
      .insertInto("playlist_posts")
      .values({
        playlist_id: playlistId,
        post_id: postId2,
        position: 1,
      })
      .execute();
  });

  it("reorders posts", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.reorder({
        playlistId,
        items: [
          { postId, position: 1 },
          { postId: postId2, position: 0 },
        ],
      }),
    );

    expect(result).toEqual({ success: true });

    const entries = await db
      .selectFrom("playlist_posts")
      .selectAll()
      .orderBy("position", "asc")
      .execute();
    expect(entries[0]!.post_id).toBe(postId2);
    expect(entries[1]!.post_id).toBe(postId);
  });

  it("rejects an incomplete reorder with ValidationError", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    // Missing postId2: the submitted set does not cover the playlist.
    const error = await runFailure(
      PlaylistsService.reorder({
        playlistId,
        items: [{ postId, position: 0 }],
      }),
    );
    expect(error._tag).toBe("ValidationError");
    expect(error.message).toBe(
      "Reorder items must cover every post in the playlist exactly once",
    );

    // Entries untouched by the rejected reorder.
    const entries = await db
      .selectFrom("playlist_posts")
      .selectAll()
      .orderBy("position", "asc")
      .execute();
    expect(entries[0]!.position).toBe(0);
    expect(entries[1]!.position).toBe(1);
  });

  it("rejects a reorder containing an unknown post", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const error = await runFailure(
      PlaylistsService.reorder({
        playlistId,
        items: [
          { postId, position: 0 },
          { postId: postId2, position: 1 },
          { postId: asPostId(9999), position: 2 },
        ],
      }),
    );
    expect(error._tag).toBe("ValidationError");
  });

  it("accepts duplicate positions (no uniqueness enforced)", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    // As implemented: positions are written verbatim; colliding positions
    // are the client's problem (ordering falls back to insertion order).
    const result = await runEffect(
      PlaylistsService.reorder({
        playlistId,
        items: [
          { postId, position: 0 },
          { postId: postId2, position: 0 },
        ],
      }),
    );
    expect(result).toEqual({ success: true });

    const entries = await db
      .selectFrom("playlist_posts")
      .selectAll()
      .orderBy("post_id", "asc")
      .execute();
    expect(entries.map((row) => row.position)).toEqual([0, 0]);
  });

  it("rolls back the whole removal when resequencing fails mid-transaction", async () => {
    // Fail the resequence (position 0 violates the constraint) AFTER the
    // delete already ran: the transaction must roll the delete back too.
    // NOT VALID skips validating the existing rows — the constraint only
    // bites the resequence's UPDATE.
    await sql`ALTER TABLE playlist_posts ADD CONSTRAINT test_pos_floor CHECK (position < 0) NOT VALID`.execute(
      db,
    );
    try {
      mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));
      const error = await runFailure(
        PlaylistsService.removePost({ playlistId, postId }),
      );
      expect(error._tag).toBe("SqlError");
    } finally {
      await sql`ALTER TABLE playlist_posts DROP CONSTRAINT test_pos_floor`.execute(
        db,
      );
    }

    // Nothing was removed: both rows keep their original positions.
    const entries = await db
      .selectFrom("playlist_posts")
      .selectAll()
      .orderBy("position", "asc")
      .execute();
    expect(entries).toHaveLength(2);
    expect(entries[0]!.post_id).toBe(postId);
    expect(entries[0]!.position).toBe(0);
    expect(entries[1]!.post_id).toBe(postId2);
    expect(entries[1]!.position).toBe(1);
  });

  it("throws forbidden when not the playlist owner", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser2));

    const error = await runFailure(
      PlaylistsService.reorder({
        playlistId,
        items: [{ postId, position: 0 }],
      }),
    );
    expect(error._tag).toBe("ForbiddenError");
  });
});

describe(PlaylistsService.fetchUserPlaylists, () => {
  beforeEach(async () => {
    await db
      .insertInto("playlists")
      .values({
        title: "Public List",
        is_public: true,
        user_id: "user-1",
        created_at: new Date("2024-01-01T00:00:00Z"),
      })
      .execute();
    await db
      .insertInto("playlists")
      .values({
        title: "Private List",
        is_public: false,
        user_id: "user-1",
        created_at: new Date("2024-01-02T00:00:00Z"),
      })
      .execute();
  });

  it("returns all playlists for the owner", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.fetchUserPlaylists("user-1"),
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("Private List");
    expect(result[1]!.title).toBe("Public List");
  });

  it("returns only public playlists for non-owner", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser2));

    const result = await runEffect(
      PlaylistsService.fetchUserPlaylists("user-1"),
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("Public List");
  });

  it("returns playlist with post count", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const playlists = await db
      .selectFrom("playlists")
      .select(["id"])
      .where("title", "=", "Public List")
      .executeTakeFirstOrThrow();

    await db
      .insertInto("playlist_posts")
      .values({
        playlist_id: playlists.id,
        post_id: postId,
        position: 0,
      })
      .execute();
    await db
      .insertInto("playlist_posts")
      .values({
        playlist_id: playlists.id,
        post_id: postId2,
        position: 1,
      })
      .execute();

    mockGetSession.mockReset();
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.fetchUserPlaylists("user-1"),
    );

    const publicList = result.find(
      (p: (typeof result)[number]) => p.title === "Public List",
    )!;
    expect(publicList.post_count).toBe(2);

    const privateList = result.find(
      (p: (typeof result)[number]) => p.title === "Private List",
    )!;
    expect(privateList.post_count).toBe(0);
  });

  it("returns playlist with thumbnail from first post", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const playlists = await db
      .selectFrom("playlists")
      .select(["id"])
      .where("title", "=", "Public List")
      .executeTakeFirstOrThrow();

    await db
      .insertInto("playlist_posts")
      .values({
        playlist_id: playlists.id,
        post_id: postId,
        position: 0,
      })
      .execute();

    mockGetSession.mockReset();
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.fetchUserPlaylists("user-1"),
    );

    const publicList = result.find(
      (p: (typeof result)[number]) => p.title === "Public List",
    )!;
    expect(publicList.thumbnail_key).toBe("thumbnails/abc.jpg");
  });
});

describe(PlaylistsService.fetchPublicPlaylists, () => {
  beforeEach(async () => {
    await db
      .insertInto("playlists")
      .values({
        title: "Older Public",
        is_public: true,
        user_id: "user-1",
        created_at: new Date("2024-01-01T00:00:00Z"),
      })
      .execute();
    await db
      .insertInto("playlists")
      .values({
        title: "Newer Public",
        is_public: true,
        user_id: "user-2",
        created_at: new Date("2024-02-01T00:00:00Z"),
      })
      .execute();
    await db
      .insertInto("playlists")
      .values({
        title: "Private",
        is_public: false,
        user_id: "user-1",
        created_at: new Date("2024-03-01T00:00:00Z"),
      })
      .execute();
  });

  it("returns only public playlists ordered newest first", async () => {
    const result = await runEffect(
      PlaylistsService.fetchPublicPlaylists({ page: 0 }),
    );

    expect(result.data.map((p) => p.title)).toEqual([
      "Newer Public",
      "Older Public",
    ]);
    expect(result.meta.pagination.total).toBe(2);
    expect(result.meta.pagination.totalPages).toBe(1);
  });

  it("includes post count and thumbnail from first post", async () => {
    const playlists = await db
      .selectFrom("playlists")
      .select(["id"])
      .where("title", "=", "Newer Public")
      .executeTakeFirstOrThrow();

    await db
      .insertInto("playlist_posts")
      .values({
        playlist_id: playlists.id,
        post_id: postId,
        position: 0,
      })
      .execute();
    await db
      .insertInto("playlist_posts")
      .values({
        playlist_id: playlists.id,
        post_id: postId2,
        position: 1,
      })
      .execute();

    const result = await runEffect(
      PlaylistsService.fetchPublicPlaylists({ page: 0 }),
    );

    const newer = result.data.find((p) => p.title === "Newer Public")!;
    expect(newer.post_count).toBe(2);
    expect(newer.thumbnail_key).toBe("thumbnails/abc.jpg");
  });

  it("includes the owner name and image", async () => {
    const result = await runEffect(
      PlaylistsService.fetchPublicPlaylists({ page: 0 }),
    );

    const newer = result.data.find((p) => p.title === "Newer Public")!;
    expect(newer.user_id).toBe("user-2");
    expect(newer.user_name).toBe("Bob");
    expect(newer.user_image).toBeNull();
  });

  it("returns empty data when no public playlists exist", async () => {
    await db.deleteFrom("playlists").execute();

    const result = await runEffect(
      PlaylistsService.fetchPublicPlaylists({ page: 0 }),
    );

    expect(result.data).toEqual([]);
    expect(result.meta.pagination.total).toBe(0);
  });
});

describe(PlaylistsService.fetchDetail, () => {
  let playlistId: PlaylistId;

  beforeEach(async () => {
    const row = await db
      .insertInto("playlists")
      .values({
        title: "Detail List",
        is_public: true,
        user_id: "user-1",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    playlistId = asPlaylistId(row.id);

    await db
      .insertInto("playlist_posts")
      .values({
        playlist_id: playlistId,
        post_id: postId,
        position: 0,
      })
      .execute();
    await db
      .insertInto("playlist_posts")
      .values({
        playlist_id: playlistId,
        post_id: postId2,
        position: 1,
      })
      .execute();
  });

  it("returns playlist with posts for owner", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.fetchDetail({ playlistId, page: 0 }),
    );

    expect(result.playlist.title).toBe("Detail List");
    expect(result.playlist.post_count).toBe(2);
    expect(result.playlist.thumbnail_key).toBe("thumbnails/abc.jpg");
    expect(result.data).toHaveLength(2);
    expect(
      (result.data[0] as { post_id: number; position: number }).post_id,
    ).toBe(postId);
    expect(
      (result.data[1] as { post_id: number; position: number }).post_id,
    ).toBe(postId2);
    expect(result.meta.pagination.total).toBe(2);
  });

  it("returns playlist for public playlist when not owner", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser2));

    const result = await runEffect(
      PlaylistsService.fetchDetail({ playlistId, page: 0 }),
    );

    expect(result.playlist.title).toBe("Detail List");
    expect(result.data).toHaveLength(2);
  });

  it("returns not found for private playlist when not owner", async () => {
    const row = await db
      .insertInto("playlists")
      .values({
        title: "Secret List",
        is_public: false,
        user_id: "user-1",
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser2));

    const error = await runFailure(
      PlaylistsService.fetchDetail({
        playlistId: asPlaylistId(row.id),
        page: 0,
      }),
    );
    expect(error).toMatchObject({
      _tag: "PlaylistNotFoundError",
      playlistId: row.id,
    });
  });

  it("marks orphan posts in playlist", async () => {
    const deletedPostId = await insertPost({
      title: "Will Delete",
      videoKey: "videos/xyz.mp4",
      thumbnailKey: "thumbnails/xyz.jpg",
    });

    await db
      .insertInto("playlist_posts")
      .values({
        playlist_id: playlistId,
        post_id: deletedPostId,
        position: 2,
      })
      .execute();

    await db.deleteFrom("posts").where("id", "=", deletedPostId).execute();

    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(
      PlaylistsService.fetchDetail({ playlistId, page: 0 }),
    );

    const orphan = result.data.find(
      (
        item:
          | { orphan: true; post_id: number; position: number; added_at: Date }
          | Record<string, unknown>,
      ): item is {
        orphan: true;
        post_id: number;
        position: number;
        added_at: Date;
      } => "orphan" in item && item.orphan === true,
    );
    expect(orphan).toBeDefined();
    expect((orphan as { post_id: number; orphan: true }).post_id).toBe(
      deletedPostId,
    );
  });
});

describe(PlaylistsService.fetchForPost, () => {
  let playlistId: PlaylistId;
  let playlistId2: number;

  beforeEach(async () => {
    const row1 = await db
      .insertInto("playlists")
      .values({
        title: "List A",
        is_public: false,
        user_id: "user-1",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    playlistId = asPlaylistId(row1.id);

    const row2 = await db
      .insertInto("playlists")
      .values({
        title: "List B",
        is_public: false,
        user_id: "user-1",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    playlistId2 = row2.id;
  });

  it("returns all user playlists with containsPost flag", async () => {
    await db
      .insertInto("playlist_posts")
      .values({
        playlist_id: playlistId,
        post_id: postId,
        position: 0,
      })
      .execute();

    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(PlaylistsService.fetchForPost(postId));

    expect(result).toHaveLength(2);

    const listA = result.find(
      (p: (typeof result)[number]) => p.id === playlistId,
    )!;
    expect(listA.contains_post).toBe(true);

    const listB = result.find(
      (p: (typeof result)[number]) => p.id === playlistId2,
    )!;
    expect(listB.contains_post).toBe(false);
  });

  it("returns empty array when user has no playlists", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser2));

    const result = await runEffect(PlaylistsService.fetchForPost(postId));

    expect(result).toHaveLength(0);
  });

  it("throws unauthorized when not logged in", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const error = await runFailure(PlaylistsService.fetchForPost(postId));
    expect(error).toMatchObject({
      _tag: "UnauthorizedError",
      message: "You must be logged in",
    });
  });
});

describe("PlaylistsService.delete_ cascading", () => {
  it("does not delete posts when playlist is deleted", async () => {
    const row = await db
      .insertInto("playlists")
      .values({ title: "Safe", is_public: false, user_id: "user-1" })
      .returning("id")
      .executeTakeFirstOrThrow();

    await db
      .insertInto("playlist_posts")
      .values({
        playlist_id: row.id,
        post_id: postId,
        position: 0,
      })
      .execute();

    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));
    await runEffect(PlaylistsService.delete_(asPlaylistId(row.id)));

    const posts = await db
      .selectFrom("posts")
      .selectAll()
      .where("id", "=", postId)
      .execute();
    expect(posts).toHaveLength(1);
  });
});
