import { Effect } from "effect";
import type { Kysely } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";

import type { DB } from "../db/kysely";
import { createTestKysely, makeTestLayer } from "../db/test-utils";
import { getAllTagsEffect, getAllPopularTagsEffect } from "./tags.fn";

let db: Kysely<DB>;
let testLayer: ReturnType<typeof makeTestLayer>;

beforeEach(async () => {
  const result = await createTestKysely();
  db = result.db;
  testLayer = makeTestLayer(db, null, () => new Headers());
});

const runEffect = <T>(effect: Effect.Effect<T>) =>
  Effect.runPromise(effect.pipe(Effect.provide(testLayer)));

describe(getAllTagsEffect, () => {
  it("returns empty array when no tags", async () => {
    const result = await runEffect(getAllTagsEffect());
    expect(result).toEqual([]);
  });

  it("returns all tags", async () => {
    await db.insertInto("tags").values({ name: "anime" }).execute();
    await db.insertInto("tags").values({ name: "sakuga" }).execute();

    const result = await runEffect(getAllTagsEffect());

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.name).sort()).toEqual(["anime", "sakuga"]);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("name");
  });
});

describe(getAllPopularTagsEffect, () => {
  it("returns empty when no tags", async () => {
    const result = await runEffect(getAllPopularTagsEffect());
    expect(result).toEqual([]);
  });

  it("returns tags with post counts", async () => {
    const user = await db
      .insertInto("user")
      .values({ id: "user-1", name: "Alice", email: "alice@test.com" })
      .returning("id")
      .executeTakeFirstOrThrow();

    const post = await db
      .insertInto("posts")
      .values({
        title: "Post",
        content: "Content",
        userId: user.id,
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
      .returning("id")
      .executeTakeFirstOrThrow();

    const tag = await db
      .insertInto("tags")
      .values({ name: "anime" })
      .returning("id")
      .executeTakeFirstOrThrow();

    await db
      .insertInto("post_tags")
      .values({ postId: post.id, tagId: tag.id })
      .execute();

    const result = await runEffect(getAllPopularTagsEffect());

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("anime");
    expect(result[0].postCount).toBe(1);
  });
});
