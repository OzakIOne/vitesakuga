import { describe, expect, it } from "vitest";

import { parse, parseStrict } from "../effect/schema.utils";
import { searchPostsBaseSchema, updatePostInputSchema } from "./posts.schema";
import { parsePostId } from "./posts.service";

describe("parsePostId", () => {
  it("accepts the numeric postId sent by the client", () => {
    expect(parsePostId(1)).toBe(1);
  });

  it("accepts a string postId", () => {
    expect(parsePostId("1")).toBe(1);
  });
});

describe("searchPostsBaseSchema", () => {
  it("should use default values for empty input", () => {
    const result = parseStrict(searchPostsBaseSchema)({});
    expect(result).toStrictEqual({
      dateRange: "all",
      page: 0,
      q: "",
      sortBy: "newest",
      tags: [],
    });
  });

  it("should validate correct inputs", () => {
    const input = {
      dateRange: "month",
      page: 2,
      q: "qwe",
      sortBy: "oldest",
      tags: ["anime", "action"],
    };
    const result = parseStrict(searchPostsBaseSchema)(input);
    expect(result).toStrictEqual(input);
  });

  it("should throw on invalid page number (< 0)", () => {
    expect(() => parseStrict(searchPostsBaseSchema)({ page: -1 })).toThrow();
  });

  it("should throw on invalid sortBy option", () => {
    expect(() =>
      parseStrict(searchPostsBaseSchema)({ sortBy: "random" }),
    ).toThrow();
  });

  it("should handle partial updates correctly", () => {
    const result = parseStrict(searchPostsBaseSchema)({ q: "test" });
    expect(result.q).toBe("test");
    expect(result.page).toBe(0); // Default
    expect(result.sortBy).toBe("newest"); // Default
  });

  it("should throw on unknown extra key", () => {
    expect(() =>
      parseStrict(searchPostsBaseSchema)({ unknownKey: "value" }),
    ).toThrow();
  });
});

describe("updatePostInputSchema", () => {
  const defaultValues = {
    content: "qwe",
    postId: 1,
    relatedPostId: undefined,
    source: undefined,
    tags: [],
    title: "qwe",
  };

  it("should validate correct inputs", () => {
    const input = {
      content: "content",
      postId: 1,
      relatedPostId: 2,
      source: "https://example.com",
      tags: [
        {
          id: 1,
          name: "anime",
        },
      ],
      title: "title",
    };
    const result = parseStrict(updatePostInputSchema)(input);
    expect(result).toStrictEqual(input);
  });

  it("should throw on invalid postId (< 0)", () => {
    expect(() =>
      parseStrict(updatePostInputSchema)({
        ...defaultValues,
        postId: -1,
      }),
    ).toThrow();
  });

  it("should throw on invalid relatedPostId (< 0)", () => {
    expect(() =>
      parseStrict(updatePostInputSchema)({
        ...defaultValues,
        relatedPostId: -1,
      }),
    ).toThrow();
  });

  it("should throw on invalid source", () => {
    expect(() =>
      parseStrict(updatePostInputSchema)({
        ...defaultValues,
        source: "invalid",
      }),
    ).toThrow();
  });

  it("should throw on invalid tags", () => {
    expect(() =>
      parseStrict(updatePostInputSchema)({
        ...defaultValues,
        tags: ["invalid"],
      }),
    ).toThrow();
  });

  it("should throw on invalid title", () => {
    expect(() =>
      parseStrict(updatePostInputSchema)({
        ...defaultValues,
        title: "",
      }),
    ).toThrow();
  });

  it("should throw on invalid content", () => {
    expect(() =>
      parseStrict(updatePostInputSchema)({
        ...defaultValues,
        content: "",
      }),
    ).toThrow();
  });

  it("should purify content", () => {
    const result = parseStrict(updatePostInputSchema)({
      ...defaultValues,
      content: "<script>alert('xss')</script>",
    });
    expect(result.content).toBe("");
  });

  it("should purify title", () => {
    const result = parseStrict(updatePostInputSchema)({
      ...defaultValues,
      title: "<script>alert('xss')</script>",
    });
    expect(result.title).toBe("");
  });
});
