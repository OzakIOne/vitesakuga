import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DB } from "../db/kysely";
import {
  makeServiceTestLayer,
  type ServiceTestContext,
} from "../db/test-utils";
import { UsersService, UsersServiceLive } from "./users.service";

let db: Kysely<DB>;
let runEffect: ServiceTestContext["runEffect"];
let closeCtx: () => Promise<void>;

beforeEach(async () => {
  const ctx = await makeServiceTestLayer(UsersServiceLive);
  db = ctx.db;
  runEffect = ctx.runEffect;
  closeCtx = ctx.close;

  await db
    .insertInto("user")
    .values({
      id: "user-1",
      name: "Alice",
      email: "alice@test.com",
      username: "alice",
    })
    .execute();
  await db
    .insertInto("user")
    .values({
      id: "user-2",
      name: "Bob",
      email: "bob@test.com",
      username: "bob",
    })
    .execute();
});

afterEach(() => closeCtx());

describe("UsersService.all", () => {
  it("returns all users", async () => {
    const result = await runEffect(UsersService.all());

    expect(result).toHaveLength(2);
    expect(result.map((u) => u.name).sort()).toEqual(["Alice", "Bob"]);
  });

  it("excludes deleted (anonymized) users", async () => {
    await db
      .updateTable("user")
      .set({ deletedAt: new Date(), name: "Deleted user" })
      .where("id", "=", "user-2")
      .execute();

    const result = await runEffect(UsersService.all());

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alice");
  });

  it("returns validated user objects", async () => {
    const result = await runEffect(UsersService.all());

    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("image");
    expect(result[0]).not.toHaveProperty("email");
    expect(result[0]).not.toHaveProperty("emailVerified");
  });
});

describe("UsersService.searchMentionable", () => {
  it("matches by username prefix", async () => {
    const result = await runEffect(
      UsersService.searchMentionable({ query: "ali" }),
    );
    expect(result.map((u) => u.username)).toEqual(["alice"]);
  });

  it("matches by display name prefix, case-insensitively, and returns the handle", async () => {
    await db
      .insertInto("user")
      .values({
        id: "user-3",
        name: "Charlie Brown",
        email: "charlie@test.com",
        username: "cbrown",
      })
      .execute();

    const result = await runEffect(
      UsersService.searchMentionable({ query: "charlie" }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "user-3",
      name: "Charlie Brown",
      image: null,
      username: "cbrown",
    });
  });

  it("excludes deleted users", async () => {
    await db
      .updateTable("user")
      .set({ deletedAt: new Date() })
      .where("id", "=", "user-1")
      .execute();

    const result = await runEffect(
      UsersService.searchMentionable({ query: "a" }),
    );
    expect(result.map((u) => u.username)).toEqual([]);
  });
});

describe("UsersService.userPosts", () => {
  it("returns empty posts for user with no posts", async () => {
    const result = await runEffect(
      UsersService.userPosts({ userId: "user-1", tags: [], q: "", page: 0 }),
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
        description: "Content",
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
      UsersService.userPosts({ userId: "user-1", tags: [], q: "", page: 0 }),
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
          description: "Content",
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
      UsersService.userPosts({ userId: "user-1", tags: [], q: "", page: 0 }),
    );

    expect(result.meta.pagination.total).toBe(5);
    expect(result.meta.pagination.currentPage).toBe(1);
    expect(result.meta.pagination.totalPages).toBe(1);
    expect(result.meta.pagination.hasMore).toBe(false);
  });
});
