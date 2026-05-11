import { Effect } from "effect";
import type { Kysely } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";

import type { DB } from "../db/kysely";
import { createTestKysely, makeTestLayer } from "../db/test-utils";
import { fetchUsersEffect, fetchUserPostsEffect } from "./users.fn";

let db: Kysely<DB>;
let testLayer: ReturnType<typeof makeTestLayer>;

beforeEach(async () => {
  const result = await createTestKysely();
  db = result.db;
  testLayer = makeTestLayer(db, null, () => new Headers());

  await db
    .insertInto("user")
    .values({ id: "user-1", name: "Alice", email: "alice@test.com" })
    .execute();
  await db
    .insertInto("user")
    .values({ id: "user-2", name: "Bob", email: "bob@test.com" })
    .execute();
});

const runEffect = <T>(effect: Effect.Effect<T>) =>
  Effect.runPromise(effect.pipe(Effect.provide(testLayer)));

describe(fetchUsersEffect, () => {
  it("returns all users", async () => {
    const result = await runEffect(fetchUsersEffect());

    expect(result).toHaveLength(2);
    expect(result.map((u) => u.name).sort()).toEqual(["Alice", "Bob"]);
  });

  it("returns validated user objects", async () => {
    const result = await runEffect(fetchUsersEffect());

    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("email");
  });
});

describe(fetchUserPostsEffect, () => {
  it("returns empty posts for user with no posts", async () => {
    const result = await runEffect(
      fetchUserPostsEffect({ userId: "user-1", tags: [], q: "", page: 0 }),
    );

    expect(result.data).toEqual([]);
    expect(result.meta.pagination.total).toBe(0);
    expect(result.user.name).toBe("Alice");
  });

  it("returns posts for a user", async () => {
    await db
      .insertInto("posts")
      .values({
        title: "Alice's Post",
        content: "Content",
        userId: "user-1",
        videoKey: "videos/k.mp4",
        thumbnailKey: "thumbnails/k.jpg",
        videoMetadata: JSON.stringify({
          BitDepth: 8,
          BitRate: 1000,
          ChromaSubsampling: "4:2:0",
          CodecID: "avc1",
          ColorSpace: "bt709",
          DisplayAspectRatio: "16:9",
          Duration: 10,
          Encoded_Library_Name: "x264",
          Encoded_Library_Settings: "",
          Format_Profile: "High",
          FrameCount: 240,
          FrameRate: 24,
          Height: 720,
          Width: 1280,
          colour_primaries: "bt709",
        }),
      })
      .execute();

    const result = await runEffect(
      fetchUserPostsEffect({ userId: "user-1", tags: [], q: "", page: 0 }),
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe("Alice's Post");
    expect(result.meta.pagination.total).toBe(1);
  });

  it("returns correct pagination metadata", async () => {
    for (let i = 0; i < 5; i++) {
      await db
        .insertInto("posts")
        .values({
          title: `Post ${i}`,
          content: "Content",
          userId: "user-1",
          videoKey: `videos/k-${i}.mp4`,
          thumbnailKey: `thumbnails/k-${i}.jpg`,
          videoMetadata: JSON.stringify({
            BitDepth: 8,
            BitRate: 1000,
            ChromaSubsampling: "4:2:0",
            CodecID: "avc1",
            ColorSpace: "bt709",
            DisplayAspectRatio: "16:9",
            Duration: 10,
            Encoded_Library_Name: "x264",
            Encoded_Library_Settings: "",
            Format_Profile: "High",
            FrameCount: 240,
            FrameRate: 24,
            Height: 720,
            Width: 1280,
            colour_primaries: "bt709",
          }),
        })
        .execute();
    }

    const result = await runEffect(
      fetchUserPostsEffect({ userId: "user-1", tags: [], q: "", page: 0 }),
    );

    expect(result.meta.pagination.total).toBe(5);
    expect(result.meta.pagination.currentPage).toBe(1);
    expect(result.meta.pagination.totalPages).toBe(1);
    expect(result.meta.pagination.hasMore).toBe(false);
  });
});
