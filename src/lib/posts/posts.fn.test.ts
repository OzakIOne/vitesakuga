import { Effect, Layer } from "effect";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeAuthSession } from "../auth/session.fixture";
import type { DB } from "../db/kysely";
import {
  makeServiceTestLayer,
  type ServiceTestContext,
} from "../db/test-utils";
import { safeParseStrict } from "../effect/schema.utils";
import { asPostId } from "../ids";
import { StorageError, StorageModule } from "../storage/storage.module";
import { FormFileUploadSchema, MAX_IMAGE_SIZE_BYTES } from "./posts.schema";
import { PostsService, PostsServiceLive } from "./posts.service";

let db: Kysely<DB>;
let runEffect: ServiceTestContext["runEffect"];
let mockGetSession: ReturnType<typeof vi.fn>;
let closeCtx: () => Promise<void>;

const testUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@test.com",
  image: null,
  username: "alice",
};

beforeEach(async () => {
  const ctx = await makeServiceTestLayer(PostsServiceLive);
  db = ctx.db;
  runEffect = ctx.runEffect;
  mockGetSession = ctx.mockGetSession;
  closeCtx = ctx.close;

  await db.insertInto("user").values(testUser).execute();
});

afterEach(() => closeCtx());

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
    expect(result.data[0]!.title).toBe("Anime Sakuga");
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
    expect(result.data[0]!.title).toBe("100% Anime");
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
    await insertPost({ title: "Untagged Post" });
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
    expect(result.data[0]!.title).toBe("Tagged Post");
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
    expect(result.meta.popularTags[0]!.name).toBe("anime");
    expect(result.meta.popularTags[0]!.postCount).toBe(1);
  });

  it("filters by date range", async () => {
    const now = Date.now();
    const DAY_MS = 86_400_000;
    await insertPost({ title: "Posted today", createdAt: new Date(now) });
    await insertPost({
      title: "Posted 3 days ago",
      createdAt: new Date(now - 3 * DAY_MS),
    });
    await insertPost({
      title: "Posted 10 days ago",
      createdAt: new Date(now - 10 * DAY_MS),
    });
    await insertPost({
      title: "Posted 40 days ago",
      createdAt: new Date(now - 40 * DAY_MS),
    });

    const search = (dateRange: "today" | "week" | "month" | "all") =>
      runEffect(
        PostsService.search({
          q: "",
          tags: [],
          page: 0,
          sortBy: "newest",
          dateRange,
        }),
      ).then((result) => result.data.map((post) => post.title));

    expect(await search("today")).toEqual(["Posted today"]);
    expect(await search("week")).toEqual(["Posted today", "Posted 3 days ago"]);
    expect(await search("month")).toEqual([
      "Posted today",
      "Posted 3 days ago",
      "Posted 10 days ago",
    ]);
    expect(await search("all")).toHaveLength(4);
  });

  it("sorts by oldest and newest on createdAt", async () => {
    await insertPost({
      title: "Middle",
      createdAt: new Date("2024-06-01"),
    });
    await insertPost({ title: "Oldest", createdAt: new Date("2024-01-01") });
    await insertPost({ title: "Newest", createdAt: new Date("2024-12-01") });

    const search = (sortBy: "newest" | "oldest") =>
      runEffect(
        PostsService.search({
          q: "",
          tags: [],
          page: 0,
          sortBy,
          dateRange: "all",
        }),
      ).then((result) => result.data.map((post) => post.title));

    expect(await search("newest")).toEqual(["Newest", "Middle", "Oldest"]);
    expect(await search("oldest")).toEqual(["Oldest", "Middle", "Newest"]);
  });

  it("reports per-post like and dislike counts", async () => {
    const likedPost = await insertPost({ title: "Well liked" });
    const dislikedPost = await insertPost({ title: "Controversial" });

    for (const [index, voter] of ["voter-1", "voter-2", "voter-3"].entries()) {
      await db
        .insertInto("user")
        .values({
          email: `${voter}@test.com`,
          id: voter,
          name: voter,
          username: voter,
        })
        .execute();
      await db
        .insertInto("post_votes")
        .values({
          postId: likedPost,
          userId: voter,
          vote: index === 2 ? "dislike" : "like",
        })
        .execute();
    }
    await db
      .insertInto("post_votes")
      .values({ postId: dislikedPost, userId: "voter-1", vote: "dislike" })
      .execute();

    const result = await runEffect(
      PostsService.search({
        q: "",
        tags: [],
        page: 0,
        sortBy: "newest",
        dateRange: "all",
      }),
    );

    const liked = result.data.find((post) => post.title === "Well liked");
    expect(liked?.likes).toBe(2);
    expect(liked?.dislikes).toBe(1);

    const disliked = result.data.find((post) => post.title === "Controversial");
    expect(disliked?.likes).toBe(0);
    expect(disliked?.dislikes).toBe(1);
  });

  it("scopes popular tags to the search query", async () => {
    const mechaPost = await insertPost({
      description: "all about mecha",
      title: "Mecha Ramble",
    });
    const mechaTag = await insertTag("mecha");
    await linkTags(mechaPost, [mechaTag]);
    const cookingPost = await insertPost({ title: "Cooking Show" });
    const cookingTag = await insertTag("cooking");
    await linkTags(cookingPost, [cookingTag]);

    const result = await runEffect(
      PostsService.search({
        q: "mecha",
        tags: [],
        page: 0,
        sortBy: "newest",
        dateRange: "all",
      }),
    );

    // Only tags of posts matching the query are aggregated.
    expect(result.data.map((post) => post.title)).toEqual(["Mecha Ramble"]);
    expect(result.meta.popularTags.map((tag) => tag.name)).toEqual(["mecha"]);
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
    expect(result.tags[0]!.name).toBe("sakuga");
  });

  it("fails with PostNotFoundError when post is not found", async () => {
    const error = await runEffect(
      Effect.flip(PostsService.fetchDetail(asPostId(999))),
    );

    expect(error._tag).toBe("PostNotFoundError");
    if (error._tag !== "PostNotFoundError") {
      throw new Error("unreachable: _tag asserted above");
    }
    expect(error.postId).toBe(999);
    expect(error.message).toBe("Post 999 not found");
  });
});

describe("PostsService.getByTag", () => {
  it("returns posts filtered by tag", async () => {
    const postId1 = await insertPost({
      title: "Anime Post",
      videoKey: "videos/1.mp4",
    });
    await insertPost({
      title: "Other Post",
      videoKey: "videos/2.mp4",
    });
    const tagId = await insertTag("anime");
    await linkTags(postId1, [tagId]);

    const result = await runEffect(
      PostsService.getByTag({ tag: "anime", page: 0 }),
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.title).toBe("Anime Post");
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

  it("fails with UnauthorizedError when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    // UnauthorizedError messages reach clients verbatim, so the exact copy
    // is part of the contract.
    const error = await runEffect(
      Effect.flip(PostsService.upload(makeUploadInput("videos/user-1/a.mp4"))),
    );

    expect(error._tag).toBe("UnauthorizedError");
    expect(error.message).toBe("You must be logged in to upload a post");
  });

  it("confirms the direct-to-R2 upload and creates the post", async () => {
    const { key: pendingKey } = await uploadVideoToStorage();
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    const post = await runEffect(
      PostsService.upload(makeUploadInput(pendingKey)),
    );

    expect(post.id).toBeGreaterThan(0);
    // The stored key is the promoted one, out of the staging namespace.
    expect(post.videoKey).toMatch(/^videos\/user-1\/[a-f0-9-]+\.mp4$/);
    expect(post.videoKey).not.toBe(pendingKey);
    expect(post.title).toBe("Uploaded Post");
  });

  it("fails with ValidationError for a video key outside the user's staging namespace", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    const error = await runEffect(
      Effect.flip(
        PostsService.upload(makeUploadInput("videos/other-user/abc.mp4")),
      ),
    );

    expect(error._tag).toBe("ValidationError");
    expect(error.message).toBe("Invalid video upload key");
  });

  it("fails with ValidationError for a final-namespace key (uploads must be staged first)", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    const error = await runEffect(
      Effect.flip(PostsService.upload(makeUploadInput("videos/user-1/a.mp4"))),
    );

    expect(error._tag).toBe("ValidationError");
    expect(error.message).toBe("Invalid video upload key");
  });

  it("fails with ValidationError for a video key that was never uploaded", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    const error = await runEffect(
      Effect.flip(
        PostsService.upload(
          makeUploadInput("videos/_pending/user-1/never-uploaded.mp4"),
        ),
      ),
    );

    expect(error._tag).toBe("ValidationError");
    expect(error.message).toContain("Video upload could not be verified");
  });
});

describe("PostsService.createVideoUploadUrl", () => {
  it("fails with UnauthorizedError when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const error = await runEffect(
      Effect.flip(PostsService.createVideoUploadUrl({ fileName: "clip.mp4" })),
    );

    expect(error._tag).toBe("UnauthorizedError");
    expect(error.message).toBe("You must be logged in to upload a post");
  });

  it("presigns a direct-to-R2 upload for the session user", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

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
  it("fails with UnauthorizedError when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const postId = await insertPost();

    const error = await runEffect(
      Effect.flip(
        PostsService.update({
          postId,
          title: "Hacked",
          description: "Bad",
          source: "",
          relatedPostId: undefined,
          tags: [],
        }),
      ),
    );

    expect(error._tag).toBe("UnauthorizedError");
    expect(error.message).toBe("You must be logged in to update a post");
  });

  it("fails with ForbiddenError when user does not own the post", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-2" }));
    const postId = await insertPost({ userId: "user-1" });

    const error = await runEffect(
      Effect.flip(
        PostsService.update({
          postId,
          title: "Hacked",
          description: "Bad",
          source: "",
          relatedPostId: undefined,
          tags: [],
        }),
      ),
    );

    expect(error._tag).toBe("ForbiddenError");
    expect(error.message).toBe("You can only update your own posts");
  });

  it("updates post and returns the updated record", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));
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
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));
    const postId = await insertPost();
    const existingTag = await insertTag("existing");

    await runEffect(
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

describe("PostsService.upload (image posts)", () => {
  const makeImageUploadInput = (images: File[]) => ({
    description: "<p>Image post</p>",
    relatedPostId: undefined,
    source: undefined,
    tags: [],
    title: "Image Post",
    images,
  });

  const imageRowsFor = async (postId: number) =>
    db
      .selectFrom("post_images")
      .select(["position", "storageKey"])
      .where("postId", "=", postId)
      .orderBy("position", "asc")
      .execute();

  it("stores multiple images with correct positions", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    const post = await runEffect(
      PostsService.upload(
        makeImageUploadInput([
          new File(["first"], "first.png", { type: "image/png" }),
          new File(["second"], "second.jpg", { type: "image/jpeg" }),
          new File(["third"], "third.webp", { type: "image/webp" }),
        ]),
      ),
    );

    const imageRows = await imageRowsFor(post.id);

    expect(imageRows).toHaveLength(3);
    expect(imageRows.map((row) => row.position)).toEqual([0, 1, 2]);
    // Keys keep the original file extension under the uploader's namespace,
    // in upload order.
    expect(imageRows[0]?.storageKey).toMatch(
      /^images\/user-1\/[a-f0-9-]+\.png$/,
    );
    expect(imageRows[1]?.storageKey).toMatch(
      /^images\/user-1\/[a-f0-9-]+\.jpg$/,
    );
    expect(imageRows[2]?.storageKey).toMatch(
      /^images\/user-1\/[a-f0-9-]+\.webp$/,
    );

    // Image posts carry the reserved "image" media tag, not "video".
    const tags = await db
      .selectFrom("post_tags")
      .innerJoin("tags", "tags.id", "post_tags.tagId")
      .select("tags.name")
      .where("post_tags.postId", "=", post.id)
      .execute();
    expect(tags.map((t) => t.name)).toEqual(["image"]);
  });

  it("promotes the first image to the post thumbnail", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    const post = await runEffect(
      PostsService.upload(
        makeImageUploadInput([
          new File(["first"], "first.jpg", { type: "image/jpeg" }),
          new File(["second"], "second.jpg", { type: "image/jpeg" }),
        ]),
      ),
    );

    const [firstImage] = await imageRowsFor(post.id);
    const postRow = await db
      .selectFrom("posts")
      .select(["thumbnailKey", "videoKey"])
      .where("id", "=", post.id)
      .executeTakeFirstOrThrow();

    expect(postRow.thumbnailKey).toBe(firstImage?.storageKey);
    expect(postRow.videoKey).toBeNull();
  });

  it("fails with ValidationError when an image post carries neither images nor a thumbnail", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    const error = await runEffect(
      Effect.flip(
        PostsService.upload({
          description: "<p>No media</p>",
          relatedPostId: undefined,
          source: undefined,
          tags: [],
          title: "Empty Post",
        }),
      ),
    );

    expect(error._tag).toBe("ValidationError");
    expect(error.message).toBe("Thumbnail is required");
  });

  it("rejects images with unsupported extensions before the service runs", () => {
    // Invalid images never reach PostsService.upload: the server-fn
    // validator's schema (ImageFile refines) rejects them first, so the
    // typed failure here is the ParseError boundary, not a domain error.
    const result = safeParseStrict(FormFileUploadSchema)(
      makeImageUploadInput([
        new File(["x"], "evil.gif", { type: "image/gif" }),
      ]),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain(
        "Images must be JPEG, PNG or WebP files",
      );
    }
  });

  it("rejects oversized images before the service runs", () => {
    const oversized = new File(
      [new Uint8Array(MAX_IMAGE_SIZE_BYTES + 1)],
      "big.png",
      { type: "image/png" },
    );

    const result = safeParseStrict(FormFileUploadSchema)(
      makeImageUploadInput([oversized]),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("Images must not exceed 10 MB");
    }
  });

  it("rolls back uploaded images and leaves no post row when a storage upload fails", async () => {
    const uploadedKeys: string[] = [];
    let realStorage: StorageModule["Service"] | undefined;

    // First image upload succeeds (its key is recorded), second fails —
    // the service must delete the first object and write nothing to the DB.
    const failingImageStorageLayer = Layer.effect(
      StorageModule,
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        realStorage = storage;
        let imageUploadCalls = 0;
        return {
          ...storage,
          uploadImage: (userId: string, file: File) => {
            imageUploadCalls += 1;
            if (imageUploadCalls > 1) {
              return Effect.fail(
                new StorageError({
                  cause: "simulated storage outage",
                  key: `images/${userId}/simulated-failure.png`,
                  message: "Simulated image upload failure",
                  operation: "upload",
                }),
              );
            }
            return Effect.gen(function* () {
              const { key } = yield* storage.uploadImage(userId, file);
              uploadedKeys.push(key);
              return { key };
            });
          },
        };
      }),
    );

    const ctx = await makeServiceTestLayer(
      PostsServiceLive.pipe(Layer.provide(failingImageStorageLayer)),
    );
    try {
      await ctx.db.insertInto("user").values(testUser).execute();
      ctx.mockGetSession.mockResolvedValueOnce(
        makeAuthSession({ id: "user-1" }),
      );

      const error = await ctx.runEffect(
        Effect.flip(
          PostsService.upload(
            makeImageUploadInput([
              new File(["first"], "first.png", { type: "image/png" }),
              new File(["second"], "second.png", { type: "image/png" }),
            ]),
          ),
        ),
      );

      expect(error._tag).toBe("StorageError");
      if (error._tag !== "StorageError") {
        throw new Error("unreachable: _tag asserted above");
      }
      expect(error.operation).toBe("upload");

      // The DB never saw the post.
      expect(
        await ctx.db.selectFrom("posts").selectAll().execute(),
      ).toHaveLength(0);
      expect(
        await ctx.db.selectFrom("post_images").selectAll().execute(),
      ).toHaveLength(0);

      // Rollback deleted the already-uploaded image from RustFS.
      expect(uploadedKeys).toHaveLength(1);
      if (!realStorage) throw new Error("storage layer was not built");
      const headFailure = await ctx.runEffect(
        Effect.flip(realStorage.headFile(uploadedKeys[0] ?? "")),
      );
      expect(headFailure._tag).toBe("StorageError");
      expect(headFailure.operation).toBe("head");
    } finally {
      await ctx.close();
    }
  });
});
