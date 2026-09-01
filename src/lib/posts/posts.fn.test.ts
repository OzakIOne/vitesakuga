import { Effect } from "effect";
import type { Kysely } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
import { asPostId } from "../ids";
import { StorageModule } from "../storage/storage.module";
import { PostsService, PostsServiceLive } from "./posts.service";

let db: Kysely<DB>;
let runEffect: ReturnType<typeof makeServiceTestLayer>["runEffect"];
let mockGetSession: ReturnType<typeof vi.fn>;

const testUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@test.com",
  image: null,
};

beforeEach(async () => {
  const ctx = await makeServiceTestLayer(PostsServiceLive);
  db = ctx.db;
  runEffect = ctx.runEffect;
  mockGetSession = ctx.mockGetSession;

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
    description: string;
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
    description: "<p>Test description</p>",
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
  // SAFETY: posts.id is the table's primary key.
  return asPostId(result.id);
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

describe("PostsService.search", () => {
  it("returns empty results when no posts exist", async () => {
    const result = await runEffect(
      PostsService.search({
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
    await insertPost({ title: "Post 1", description: "Content 1" });
    await insertPost({ title: "Post 2", description: "Content 2" });

    const result = await runEffect(
      PostsService.search({
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
    await insertPost({ title: "Anime Sakuga", description: "Great animation" });
    await insertPost({ title: "Regular Post", description: "Nothing here" });

    const result = await runEffect(
      PostsService.search({
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

  it("treats search wildcards as literals", async () => {
    await insertPost({ title: "100% Anime", description: "literal percent" });
    await insertPost({ title: "Plain Post", description: "no percent" });

    const result = await runEffect(
      PostsService.search({
        q: "100%",
        tags: [],
        page: 0,
        sortBy: "newest",
        dateRange: "all",
      }),
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe("100% Anime");
  });

  it("does not treat a bare percent query as match-all", async () => {
    await insertPost({ title: "Anime", description: "Sakuga" });

    const result = await runEffect(
      PostsService.search({
        q: "%",
        tags: [],
        page: 0,
        sortBy: "newest",
        dateRange: "all",
      }),
    );

    expect(result.data).toHaveLength(0);
  });

  it("filters by tags", async () => {
    const postId1 = await insertPost({ title: "Tagged Post" });
    const postId2 = await insertPost({ title: "Untagged Post" });
    const tagId = await insertTag("anime");
    await linkTags(postId1, [tagId]);

    const result = await runEffect(
      PostsService.search({
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
      PostsService.search({
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
      PostsService.search({
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

describe("PostsService.fetchDetail", () => {
  it("returns post details with user and empty tags", async () => {
    const postId = await insertPost({
      title: "Detail Post",
      description: "<p>Rich description</p>",
      source: "https://example.com",
    });

    const result = await runEffect(PostsService.fetchDetail(postId));

    expect(result.post.title).toBe("Detail Post");
    expect(result.post.description).toBe("<p>Rich description</p>");
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

    const result = await runEffect(PostsService.fetchDetail(postId));

    expect(result.tags).toHaveLength(1);
    expect(result.tags[0].name).toBe("sakuga");
  });

  it("throws when post is not found", async () => {
    await expect(
      runEffect(PostsService.fetchDetail(asPostId(999))),
    ).rejects.toThrow("Post 999 not found");
  });
});

describe("PostsService.getByTag", () => {
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
      PostsService.getByTag({ tag: "anime", page: 0 }),
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe("Anime Post");
    expect(result.meta.pagination.total).toBe(1);
  });

  it("returns empty when tag has no posts", async () => {
    await insertTag("empty-tag");
    await insertPost({ title: "Some Post" });

    const result = await runEffect(
      PostsService.getByTag({ tag: "empty-tag", page: 0 }),
    );

    expect(result.data).toHaveLength(0);
    expect(result.meta.pagination.total).toBe(0);
  });
});

describe("PostsService.upload", () => {
  // Mirror the real client flow: presign a staging key, PUT the bytes to R2,
  // and hand the staging key to the confirm step.
  const uploadVideoToStorage = async (name = "video.mp4") => {
    const file = new File(["video bytes"], name, { type: "video/mp4" });
    const staged = await runEffect(
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        return yield* storage.presignVideoUpload("user-1", "mp4");
      }),
    );
    const response = await fetch(staged.url, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": staged.contentType },
    });
    expect(response.ok).toBe(true);
    return { key: staged.key };
  };

  const makeUploadInput = (videoKey: string) => ({
    description: "<p>Test upload</p>",
    relatedPostId: undefined,
    source: undefined,
    tags: [],
    thumbnail: new File(["thumb"], "thumb.jpg", { type: "image/jpeg" }),
    title: "Uploaded Post",
    videoKey,
    videoMetadata: undefined,
  });

  it("throws unauthorized when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(
      runEffect(PostsService.upload(makeUploadInput("videos/user-1/a.mp4"))),
    ).rejects.toThrow("You must be logged in");
  });

  it("confirms the direct-to-R2 upload and creates the post", async () => {
    const { key: pendingKey } = await uploadVideoToStorage();
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    const post = await runEffect(
      PostsService.upload(makeUploadInput(pendingKey)),
    );

    expect(post.id).toBeGreaterThan(0);
    // The stored key is the promoted one, out of the staging namespace.
    expect(post.videoKey).toMatch(/^videos\/user-1\/[a-f0-9-]+\.mp4$/);
    expect(post.videoKey).not.toBe(pendingKey);
    expect(post.title).toBe("Uploaded Post");
  });

  it("rejects a video key outside the user's staging namespace", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    await expect(
      runEffect(
        PostsService.upload(makeUploadInput("videos/other-user/abc.mp4")),
      ),
    ).rejects.toThrow("Invalid video upload key");
  });

  it("rejects a final-namespace key (uploads must be staged first)", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    await expect(
      runEffect(PostsService.upload(makeUploadInput("videos/user-1/a.mp4"))),
    ).rejects.toThrow("Invalid video upload key");
  });

  it("rejects a video key that was never uploaded", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    await expect(
      runEffect(
        PostsService.upload(
          makeUploadInput("videos/_pending/user-1/never-uploaded.mp4"),
        ),
      ),
    ).rejects.toThrow("Video upload could not be verified");
  });
});

describe("PostsService.createVideoUploadUrl", () => {
  it("throws unauthorized when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(
      runEffect(PostsService.createVideoUploadUrl({ fileName: "clip.mp4" })),
    ).rejects.toThrow("You must be logged in");
  });

  it("presigns a direct-to-R2 upload for the session user", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    const result = await runEffect(
      PostsService.createVideoUploadUrl({ fileName: "clip.mp4" }),
    );

    expect(result.key).toMatch(/^videos\/_pending\/user-1\/[a-f0-9-]+\.mp4$/);
    expect(result.contentType).toBe("video/mp4");
    expect(result.url).toContain(result.key);
    expect(result.url).toContain("X-Amz-Signature=");
  });
});

describe("PostsService.update", () => {
  it("throws unauthorized when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const postId = await insertPost();

    await expect(
      runEffect(
        PostsService.update({
          postId,
          title: "Hacked",
          description: "Bad",
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
        PostsService.update({
          postId,
          title: "Hacked",
          description: "Bad",
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
      PostsService.update({
        postId,
        title: "Updated",
        description: "New description",
        source: "https://new.example.com",
        relatedPostId: undefined,
        tags: [],
      }),
    );

    expect(result.title).toBe("Updated");
    expect(result.description).toBe("New description");
    expect(result.source).toBe("https://new.example.com");
  });

  it("adds tags to updated post", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    const postId = await insertPost();
    const existingTag = await insertTag("existing");

    const result = await runEffect(
      PostsService.update({
        postId,
        title: "Tagged",
        description: "Content",
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

    // The reserved media tag ("video" — the post has no post_images rows)
    // is always re-applied by the server on update.
    expect(tags.map((t) => t.name).sort()).toEqual([
      "existing",
      "new-tag",
      "video",
    ]);
  });
});
