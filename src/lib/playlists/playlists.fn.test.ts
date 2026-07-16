import type { Kysely } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
import {
  addPostToPlaylistEffect,
  createPlaylistEffect,
  deletePlaylistEffect,
  fetchPlaylistDetailEffect,
  fetchPlaylistsForPostEffect,
  fetchUserPlaylistsEffect,
  removePostFromPlaylistEffect,
  reorderPlaylistPostsEffect,
  updatePlaylistEffect,
} from "./playlists.service";
import { PlaylistsServiceLive } from "./playlists.service";

let db: Kysely<DB>;
let runEffect: ReturnType<typeof makeServiceTestLayer>["runEffect"];
let mockGetSession: ReturnType<typeof vi.fn>;

const testUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@test.com",
  image: null,
};

const testUser2 = {
  id: "user-2",
  name: "Bob",
  email: "bob@test.com",
  image: null,
};

let postId: number;
let postId2: number;

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
    content: "Content",
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
  return result.id;
};

beforeEach(async () => {
  const ctx = await makeServiceTestLayer(PlaylistsServiceLive);
  db = ctx.db;
  runEffect = ctx.runEffect;
  mockGetSession = ctx.mockGetSession;

  await db.insertInto("user").values(testUser).execute();
  await db.insertInto("user").values(testUser2).execute();

  await db.deleteFrom("playlist_posts").execute();
  await db.deleteFrom("playlists").execute();

  postId = await insertPost();
  postId2 = await insertPost({
    title: "Second Post",
    videoKey: "videos/def.mp4",
    thumbnailKey: "thumbnails/def.jpg",
  });
});

describe(createPlaylistEffect, () => {
  it("creates a playlist for the authenticated user", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    const result = await runEffect(
      createPlaylistEffect({
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
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    const result = await runEffect(
      createPlaylistEffect({ title: "Private", isPublic: false }),
    );

    expect(result.is_public).toBe(false);
  });

  it("throws unauthorized when not logged in", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(
      runEffect(createPlaylistEffect({ title: "Nope", isPublic: false })),
    ).rejects.toThrow("You must be logged in");
  });
});

describe(updatePlaylistEffect, () => {
  let playlistId: number;

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
    playlistId = row.id;
  });

  it("updates title and description", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    const result = await runEffect(
      updatePlaylistEffect({
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
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    const result = await runEffect(
      updatePlaylistEffect({ playlistId, isPublic: true }),
    );

    expect(result.is_public).toBe(true);
  });

  it("throws unauthorized when not logged in", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(
      runEffect(updatePlaylistEffect({ playlistId, title: "Hack" })),
    ).rejects.toThrow("You must be logged in");
  });

  it("throws forbidden when not the owner", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser2 });

    await expect(
      runEffect(updatePlaylistEffect({ playlistId, title: "Hack" })),
    ).rejects.toThrow("can only modify your own");
  });

  it("throws not found for non-existent playlist", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    await expect(
      runEffect(updatePlaylistEffect({ playlistId: 9999, title: "X" })),
    ).rejects.toThrow("Playlist 9999 not found");
  });
});

describe(deletePlaylistEffect, () => {
  let playlistId: number;

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
    playlistId = row.id;
  });

  it("deletes the playlist", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    const result = await runEffect(deletePlaylistEffect(playlistId));

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

    mockGetSession.mockResolvedValueOnce({ user: testUser });

    await runEffect(deletePlaylistEffect(playlistId));

    const remainingPosts = await db
      .selectFrom("playlist_posts")
      .selectAll()
      .execute();
    expect(remainingPosts).toHaveLength(0);
  });

  it("throws forbidden when not the owner", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser2 });

    await expect(runEffect(deletePlaylistEffect(playlistId))).rejects.toThrow(
      "can only modify your own",
    );
  });
});

describe(addPostToPlaylistEffect, () => {
  let playlistId: number;

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
    playlistId = row.id;
  });

  it("adds a post to the playlist", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    const result = await runEffect(
      addPostToPlaylistEffect({ playlistId, postId }),
    );

    expect(result.playlist_id).toBe(playlistId);
    expect(result.post_id).toBe(postId);
    expect(result.position).toBe(0);

    const entries = await db.selectFrom("playlist_posts").selectAll().execute();
    expect(entries).toHaveLength(1);
  });

  it("increments position for subsequent posts", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    await runEffect(addPostToPlaylistEffect({ playlistId, postId }));

    mockGetSession.mockResolvedValueOnce({ user: testUser });

    const result = await runEffect(
      addPostToPlaylistEffect({ playlistId, postId: postId2 }),
    );

    expect(result.position).toBe(1);
  });

  it("throws when adding a duplicate post", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser });
    await runEffect(addPostToPlaylistEffect({ playlistId, postId }));

    mockGetSession.mockResolvedValueOnce({ user: testUser });

    await expect(
      runEffect(addPostToPlaylistEffect({ playlistId, postId })),
    ).rejects.toThrow("already in playlist");
  });

  it("throws when post does not exist", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    await expect(
      runEffect(addPostToPlaylistEffect({ playlistId, postId: 9999 })),
    ).rejects.toThrow("Post 9999 not found");
  });

  it("throws forbidden when not the playlist owner", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser2 });

    await expect(
      runEffect(addPostToPlaylistEffect({ playlistId, postId })),
    ).rejects.toThrow("can only modify your own");
  });
});

describe(removePostFromPlaylistEffect, () => {
  let playlistId: number;

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
    playlistId = row.id;

    await db
      .insertInto("playlist_posts")
      .values({ playlist_id: playlistId, post_id: postId, position: 0 })
      .execute();
  });

  it("removes a post from the playlist", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    const result = await runEffect(
      removePostFromPlaylistEffect({ playlistId, postId }),
    );

    expect(result).toEqual({ success: true });

    const entries = await db.selectFrom("playlist_posts").selectAll().execute();
    expect(entries).toHaveLength(0);
  });

  it("does nothing when the post is not in playlist", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    const result = await runEffect(
      removePostFromPlaylistEffect({
        playlistId,
        postId: postId2,
      }),
    );

    expect(result).toEqual({ success: true });
  });

  it("throws forbidden when not the playlist owner", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser2 });

    await expect(
      runEffect(removePostFromPlaylistEffect({ playlistId, postId })),
    ).rejects.toThrow("can only modify your own");
  });
});

describe(reorderPlaylistPostsEffect, () => {
  let playlistId: number;

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
    playlistId = row.id;

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
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    const result = await runEffect(
      reorderPlaylistPostsEffect({
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

  it("throws forbidden when not the playlist owner", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser2 });

    await expect(
      runEffect(
        reorderPlaylistPostsEffect({
          playlistId,
          items: [{ postId, position: 0 }],
        }),
      ),
    ).rejects.toThrow("can only modify your own");
  });
});

describe(fetchUserPlaylistsEffect, () => {
  beforeEach(async () => {
    await db
      .insertInto("playlists")
      .values({
        title: "Public List",
        is_public: true,
        user_id: "user-1",
      })
      .execute();
    await db
      .insertInto("playlists")
      .values({
        title: "Private List",
        is_public: false,
        user_id: "user-1",
      })
      .execute();
  });

  it("returns all playlists for the owner", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    const result = await runEffect(fetchUserPlaylistsEffect("user-1"));

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Private List");
    expect(result[1].title).toBe("Public List");
  });

  it("returns only public playlists for non-owner", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser2 });

    const result = await runEffect(fetchUserPlaylistsEffect("user-1"));

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Public List");
  });

  it("returns playlist with post count", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser });

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
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    const result = await runEffect(fetchUserPlaylistsEffect("user-1"));

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
    mockGetSession.mockResolvedValueOnce({ user: testUser });

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
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    const result = await runEffect(fetchUserPlaylistsEffect("user-1"));

    const publicList = result.find(
      (p: (typeof result)[number]) => p.title === "Public List",
    )!;
    expect(publicList.thumbnail_key).toBe("thumbnails/abc.jpg");
  });
});

describe(fetchPlaylistDetailEffect, () => {
  let playlistId: number;

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
    playlistId = row.id;

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
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    const result = await runEffect(
      fetchPlaylistDetailEffect({ playlistId, page: 0 }),
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
    mockGetSession.mockResolvedValueOnce({ user: testUser2 });

    const result = await runEffect(
      fetchPlaylistDetailEffect({ playlistId, page: 0 }),
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

    mockGetSession.mockResolvedValueOnce({ user: testUser2 });

    await expect(
      runEffect(
        fetchPlaylistDetailEffect({
          playlistId: row.id,
          page: 0,
        }),
      ),
    ).rejects.toThrow("Playlist " + row.id + " not found");
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

    mockGetSession.mockResolvedValueOnce({ user: testUser });

    const result = await runEffect(
      fetchPlaylistDetailEffect({ playlistId, page: 0 }),
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

describe(fetchPlaylistsForPostEffect, () => {
  let playlistId: number;
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
    playlistId = row1.id;

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

    mockGetSession.mockResolvedValueOnce({ user: testUser });

    const result = await runEffect(fetchPlaylistsForPostEffect(postId));

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
    mockGetSession.mockResolvedValueOnce({ user: testUser2 });

    const result = await runEffect(fetchPlaylistsForPostEffect(postId));

    expect(result).toHaveLength(0);
  });

  it("throws unauthorized when not logged in", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(
      runEffect(fetchPlaylistsForPostEffect(postId)),
    ).rejects.toThrow("You must be logged in");
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

    mockGetSession.mockResolvedValueOnce({ user: testUser });
    await runEffect(deletePlaylistEffect(row.id));

    const posts = await db
      .selectFrom("posts")
      .selectAll()
      .where("id", "=", postId)
      .execute();
    expect(posts).toHaveLength(1);
  });
});
