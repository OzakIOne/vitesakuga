import { Effect, Layer } from "effect";
import type { Kysely } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSessionProvider } from "../auth/context";
import type { DB } from "../db/kysely";
import { createTestKysely, makeTestLayer } from "../db/test-utils";
import { PostsServiceLive } from "./posts.service";
import {
  fetchPostDetailEffect,
  getPostsByTagEffect,
  searchPostsEffect,
  updatePostEffect,
} from "./posts.fn";

let db: Kysely<DB>;
let testLayer: Layer.Layer<any, any>;
let mockGetSession: ReturnType<typeof vi.fn>;

const testUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@test.com",
  image: null,
};

beforeEach(async () => {
  mockGetSession = vi.fn();
  const result = await createTestKysely();
  db = result.db;
  const baseLayer = makeTestLayer(
    db,
    { api: { getSession: mockGetSession } } as AuthSessionProvider,
    () => new Headers(),
  );
  testLayer = PostsServiceLive.pipe(Layer.provideMerge(baseLayer));

  await db.insertInto("user").values(testUser).execute();
});

const defaultVideoMetadata = JSON.stringify({
  BitDepth: 8,
  BitRate: 1000000,
  ChromaSubsampling: "4:2:0",
  CodecID: "avc1",
  ColorSpace: "bt709",
  DisplayAspectRatio: "16:9",
  Duration: 10,
  Encoded_Library_Name: "x264",
  Encoded_Library_Settings: "cabac=1",
  Format_Profile: "High@L4",
  FrameCount: 240,
  FrameRate: 24,
  Height: 1080,
  Width: 1920,
  colour_primaries: "bt709",
});

const insertPost = async (
  overrides: Partial<{
    id: number;
    title: string;
    content: string;
    userId: string;
    videoKey: string;
    thumbnailKey: string;
    source: string | null;
    relatedPostId: number | null;
    videoMetadata: string;
    createdAt: Date;
  }> = {},
) => {
  const defaults = {
    title: "Test Post",
    content: "<p>Test content</p>",
    userId: "user-1",
    videoKey: "videos/user-1/abc.mp4",
    thumbnailKey: "thumbnails/user-1/abc.jpg",
    source: null as string | null,
    relatedPostId: null as number | null,
    videoMetadata: defaultVideoMetadata,
    createdAt: new Date("2024-01-01"),
  };
  const row = { ...defaults, ...overrides };
  const result = await db
    .insertInto("posts")
    .values(row)
    .returning("id")
    .executeTakeFirstOrThrow();
  return result.id;
};

const insertTag = async (name: string) => {
  const existing = await db
    .selectFrom("tags")
    .select("id")
    .where("name", "=", name)
    .executeTakeFirst();

  if (existing) return existing.id;

  const result = await db
    .insertInto("tags")
    .values({ name })
    .returning("id")
    .executeTakeFirstOrThrow();
  return result.id;
};

const linkTags = async (postId: number, tagIds: number[]) => {
  if (tagIds.length === 0) return;
  await db
    .insertInto("post_tags")
    .values(tagIds.map((tagId) => ({ postId, tagId })))
    .execute();
};

const runEffect = <T>(effect: Effect.Effect<T>) =>
  Effect.runPromise(effect.pipe(Effect.provide(testLayer)));

describe(searchPostsEffect, () => {
  it("returns empty results when no posts exist", async () => {
    const result = await runEffect(
      searchPostsEffect({
        q: "",
        tags: [],
        page: 0,
        sortBy: "newest",
        dateRange: "all",
      }),
    );

    expect(result.data).toEqual([]);
    expect(result.meta.pagination.total).toBe(0);
    expect(result.meta.popularTags).toEqual([]);
  });

  it("returns paginated posts with metadata", async () => {
    await insertPost({ title: "Post 1", content: "Content 1" });
    await insertPost({ title: "Post 2", content: "Content 2" });

    const result = await runEffect(
      searchPostsEffect({
        q: "",
        tags: [],
        page: 0,
        sortBy: "newest",
        dateRange: "all",
      }),
    );

    expect(result.data).toHaveLength(2);
    expect(result.meta.pagination.total).toBe(2);
    expect(result.meta.pagination.totalPages).toBe(1);
    expect(result.meta.pagination.hasMore).toBe(false);
    expect(result.meta.pagination.hasPrevious).toBe(false);
  });

  it("filters by search query", async () => {
    await insertPost({ title: "Anime Sakuga", content: "Great animation" });
    await insertPost({ title: "Regular Post", content: "Nothing here" });

    const result = await runEffect(
      searchPostsEffect({
        q: "anime",
        tags: [],
        page: 0,
        sortBy: "newest",
        dateRange: "all",
      }),
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe("Anime Sakuga");
  });

  it("filters by tags", async () => {
    const postId1 = await insertPost({ title: "Tagged Post" });
    const postId2 = await insertPost({ title: "Untagged Post" });
    const tagId = await insertTag("anime");
    await linkTags(postId1, [tagId]);

    const result = await runEffect(
      searchPostsEffect({
        q: "",
        tags: ["anime"],
        page: 0,
        sortBy: "newest",
        dateRange: "all",
      }),
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe("Tagged Post");
  });

  it("provides correct pagination for multiple pages", async () => {
    for (let i = 0; i < 35; i++) {
      await insertPost({ title: `Post ${i}`, videoKey: `videos/k-${i}.mp4` });
    }

    const result = await runEffect(
      searchPostsEffect({
        q: "",
        tags: [],
        page: 0,
        sortBy: "newest",
        dateRange: "all",
      }),
    );

    expect(result.data).toHaveLength(30);
    expect(result.meta.pagination.total).toBe(35);
    expect(result.meta.pagination.hasMore).toBe(true);
    expect(result.meta.pagination.totalPages).toBe(2);
  });

  it("returns popular tags", async () => {
    const postId = await insertPost({ title: "Popular Post" });
    const tagId = await insertTag("anime");
    await linkTags(postId, [tagId]);

    const result = await runEffect(
      searchPostsEffect({
        q: "",
        tags: [],
        page: 0,
        sortBy: "newest",
        dateRange: "all",
      }),
    );

    expect(result.meta.popularTags).toHaveLength(1);
    expect(result.meta.popularTags[0].name).toBe("anime");
    expect(result.meta.popularTags[0].postCount).toBe(1);
  });
});

describe(fetchPostDetailEffect, () => {
  it("returns post details with user and empty tags", async () => {
    const postId = await insertPost({
      title: "Detail Post",
      content: "<p>Rich content</p>",
      source: "https://example.com",
    });

    const result = await runEffect(fetchPostDetailEffect(postId));

    expect(result.post.title).toBe("Detail Post");
    expect(result.post.content).toBe("<p>Rich content</p>");
    expect(result.post.source).toBe("https://example.com");
    expect(result.user.name).toBe("Alice");
    expect(result.user.id).toBe("user-1");
    expect(result.tags).toEqual([]);
    expect(result.relatedPost).toBeNull();
  });

  it("returns tags for a tagged post", async () => {
    const postId = await insertPost({ title: "Tagged" });
    const tagId = await insertTag("sakuga");
    await linkTags(postId, [tagId]);

    const result = await runEffect(fetchPostDetailEffect(postId));

    expect(result.tags).toHaveLength(1);
    expect(result.tags[0].name).toBe("sakuga");
  });

  it("throws when post is not found", async () => {
    await expect(runEffect(fetchPostDetailEffect(999))).rejects.toThrow(
      "Post 999 not found",
    );
  });
});

describe(getPostsByTagEffect, () => {
  it("returns posts filtered by tag", async () => {
    const postId1 = await insertPost({
      title: "Anime Post",
      videoKey: "videos/1.mp4",
    });
    const postId2 = await insertPost({
      title: "Other Post",
      videoKey: "videos/2.mp4",
    });
    const tagId = await insertTag("anime");
    await linkTags(postId1, [tagId]);

    const result = await runEffect(
      getPostsByTagEffect({ tag: "anime", page: 0 }),
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe("Anime Post");
    expect(result.meta.pagination.total).toBe(1);
  });

  it("returns empty when tag has no posts", async () => {
    await insertTag("empty-tag");
    await insertPost({ title: "Some Post" });

    const result = await runEffect(
      getPostsByTagEffect({ tag: "empty-tag", page: 0 }),
    );

    expect(result.data).toHaveLength(0);
    expect(result.meta.pagination.total).toBe(0);
  });
});

describe(updatePostEffect, () => {
  it("throws unauthorized when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const postId = await insertPost();

    await expect(
      runEffect(
        updatePostEffect({
          postId,
          title: "Hacked",
          content: "Bad",
          source: "",
          relatedPostId: undefined,
          tags: [],
        }),
      ),
    ).rejects.toThrow("You must be logged in");
  });

  it("throws forbidden when user does not own the post", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-2" } });
    const postId = await insertPost({ userId: "user-1" });

    await expect(
      runEffect(
        updatePostEffect({
          postId,
          title: "Hacked",
          content: "Bad",
          source: "",
          relatedPostId: undefined,
          tags: [],
        }),
      ),
    ).rejects.toThrow("can only update your own");
  });

  it("updates post and returns the updated record", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    const postId = await insertPost({ title: "Old Title" });

    const result = await runEffect(
      updatePostEffect({
        postId,
        title: "Updated",
        content: "New content",
        source: "https://new.example.com",
        relatedPostId: undefined,
        tags: [],
      }),
    );

    expect(result.title).toBe("Updated");
    expect(result.content).toBe("New content");
    expect(result.source).toBe("https://new.example.com");
  });

  it("adds tags to updated post", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    const postId = await insertPost();
    const existingTag = await insertTag("existing");

    const result = await runEffect(
      updatePostEffect({
        postId,
        title: "Tagged",
        content: "Content",
        source: "",
        relatedPostId: undefined,
        tags: [{ name: "new-tag" }, { id: existingTag, name: "existing" }],
      }),
    );

    const tags = await db
      .selectFrom("post_tags")
      .innerJoin("tags", "tags.id", "post_tags.tagId")
      .select("tags.name")
      .where("post_tags.postId", "=", postId)
      .execute();

    expect(tags.map((t) => t.name).sort()).toEqual(["existing", "new-tag"]);
  });
});
