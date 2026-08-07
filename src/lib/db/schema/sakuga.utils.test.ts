import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { parse } from "../../effect/schema.utils";
import { userSelectSchema } from "./auth.schema";
import { postsSelectSchema } from "./sakuga.utils";

// `timestamp without time zone` columns come back as strings from the Neon
// serverless driver (and can vary per driver), while node-postgres returns
// `Date` instances. Row validation must accept both.
const dbTimestampString = "2026-08-07 11:52:43.626462";

const postRow = {
  content: "A test post",
  createdAt: dbTimestampString,
  id: 1,
  relatedPostId: null,
  source: null,
  thumbnailKey: "thumbnail-key",
  title: "Test title",
  userId: "user-1",
  videoKey: "video-key",
  videoMetadata: {},
};

describe("postsSelectSchema", () => {
  it("decodes DB rows with string timestamps", () => {
    const parsed = parse(postsSelectSchema)(postRow);
    expect(parsed.createdAt).toBeInstanceOf(Date);
    expect(parsed.createdAt.getTime()).toBe(
      new Date(dbTimestampString).getTime(),
    );
  });

  it("still decodes DB rows with Date timestamps", () => {
    const parsed = parse(postsSelectSchema)({
      ...postRow,
      createdAt: new Date(dbTimestampString),
    });
    expect(parsed.createdAt).toBeInstanceOf(Date);
  });

  it("decodes search result arrays containing string timestamps", () => {
    const parsed = parse(Schema.Array(postsSelectSchema))([
      postRow,
      { ...postRow, id: 2 },
    ]);
    expect(parsed.map((post) => post.id)).toEqual([1, 2]);
    expect(parsed[0]?.createdAt).toBeInstanceOf(Date);
  });
});

describe("userSelectSchema", () => {
  it("decodes users with string timestamps", () => {
    const parsed = parse(userSelectSchema)({
      createdAt: dbTimestampString,
      email: "alice@test.com",
      emailVerified: false,
      id: "user-1",
      image: null,
      name: "Alice",
      updatedAt: dbTimestampString,
    });
    expect(parsed.createdAt).toBeInstanceOf(Date);
    expect(parsed.updatedAt).toBeInstanceOf(Date);
  });
});
