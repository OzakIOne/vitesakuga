import { describe, expect, it } from "vitest";
import { searchPostsBaseSchema, updatePostInputSchema } from "./posts.schema";

describe("searchPostsBaseSchema", () => {
  it("should use default values for empty input", () => {
    const result = searchPostsBaseSchema.parse({});
    expect(result).toEqual({
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
    const result = searchPostsBaseSchema.parse(input);
    expect(result).toEqual(input);
  });

  it("should throw on invalid page number (< 0)", () => {
    expect(() => searchPostsBaseSchema.parse({ page: -1 })).toThrow();
  });

  it("should throw on invalid sortBy option", () => {
    expect(() => searchPostsBaseSchema.parse({ sortBy: "random" })).toThrow();
  });

  it("should handle partial updates correctly", () => {
    const result = searchPostsBaseSchema.parse({ q: "test" });
    expect(result.q).toBe("test");
    expect(result.page).toBe(0); // Default
    expect(result.sortBy).toBe("newest"); // Default
  });

  it("should throw on unknown extra key", () => {
    expect(() =>
      searchPostsBaseSchema.parse({ unknownKey: "value" }),
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
    const result = updatePostInputSchema.parse(input);
    expect(result).toEqual(input);
  });

  it("should throw on invalid postId (< 0)", () => {
    expect(() =>
      updatePostInputSchema.parse({
        ...defaultValues,
        postId: -1,
      }),
    ).toThrow();
  });

  it("should throw on invalid relatedPostId (< 0)", () => {
    expect(() =>
      updatePostInputSchema.parse({
        ...defaultValues,
        relatedPostId: -1,
      }),
    ).toThrow();
  });

  it("should throw on invalid source", () => {
    expect(() =>
      updatePostInputSchema.parse({
        ...defaultValues,
        source: "invalid",
      }),
    ).toThrow();
  });

  it("should throw on invalid tags", () => {
    expect(() =>
      updatePostInputSchema.parse({
        ...defaultValues,
        tags: ["invalid"],
      }),
    ).toThrow();
  });

  it("should throw on invalid title", () => {
    expect(() =>
      updatePostInputSchema.parse({
        ...defaultValues,
        title: "",
      }),
    ).toThrow();
  });

  it("should throw on invalid content", () => {
    expect(() =>
      updatePostInputSchema.parse({
        ...defaultValues,
        content: "",
      }),
    ).toThrow();
  });

  it("should purify content", () => {
    const result = updatePostInputSchema.parse({
      ...defaultValues,
      content: "<script>alert('xss')</script>",
    });
    expect(result.content).toBe("");
  });

  it("should purify title", () => {
    const result = updatePostInputSchema.parse({
      ...defaultValues,
      title: "<script>alert('xss')</script>",
    });
    expect(result.title).toBe("");
  });
});
