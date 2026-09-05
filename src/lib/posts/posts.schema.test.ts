import { describe, expect, it } from "vitest";

import { parse, parseStrict } from "../effect/schema.utils";
import "../sanitize.server";
import {
  MAX_SEARCH_QUERY_LENGTH,
  MAX_SEARCH_TAGS_COUNT,
  MAX_TAG_NAME_LENGTH,
} from "../search/search-limits";
import {
  FormFileUploadSchema,
  MAX_THUMBNAIL_SIZE_BYTES,
  searchPostsBaseSchema,
  updatePostInputSchema,
  VideoMetadataSchema,
} from "./posts.schema";

describe("VideoMetadataSchema", () => {
  it("decodes an empty metadata object (all fields optional)", () => {
    expect(parse(VideoMetadataSchema)({})).toStrictEqual({});
  });

  it("decodes a partial MediaInfo track (e.g. missing BitDepth)", () => {
    const result = parse(VideoMetadataSchema)({
      BitRate: "182200",
      Duration: "5.045",
      FrameRate: "23.976",
      Height: 720,
      Width: 1280,
    });
    expect(result).toStrictEqual({
      BitRate: 182200,
      Duration: 5.045,
      FrameRate: 23.976,
      Height: 720,
      Width: 1280,
    });
  });

  it("decodes undefined as undefined", () => {
    expect(
      parse(VideoMetadataSchema)(undefined as unknown as object),
    ).toBeUndefined();
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

  it("should throw on a search query longer than the cap", () => {
    expect(() =>
      parseStrict(searchPostsBaseSchema)({
        q: "a".repeat(MAX_SEARCH_QUERY_LENGTH + 1),
      }),
    ).toThrow();
  });

  it("should throw on more tags than the cap", () => {
    expect(() =>
      parseStrict(searchPostsBaseSchema)({
        tags: Array.from(
          { length: MAX_SEARCH_TAGS_COUNT + 1 },
          (_, index) => `tag-${index}`,
        ),
      }),
    ).toThrow();
  });

  it("should throw on a tag name longer than the cap", () => {
    expect(() =>
      parseStrict(searchPostsBaseSchema)({
        tags: ["a".repeat(MAX_TAG_NAME_LENGTH + 1)],
      }),
    ).toThrow();
  });
});

describe("updatePostInputSchema", () => {
  const defaultValues = {
    description: "qwe",
    postId: 1,
    relatedPostId: undefined,
    source: undefined,
    tags: [],
    title: "qwe",
  };

  it("should validate correct inputs", () => {
    const input = {
      description: "description",
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

  it("should throw on invalid description", () => {
    expect(() =>
      parseStrict(updatePostInputSchema)({
        ...defaultValues,
        description: "",
      }),
    ).toThrow();
  });

  it("should purify description", () => {
    const result = parseStrict(updatePostInputSchema)({
      ...defaultValues,
      description: "<script>alert('xss')</script>",
    });
    expect(result.description).toBe("");
  });

  it("should purify title", () => {
    const result = parseStrict(updatePostInputSchema)({
      ...defaultValues,
      title: "<script>alert('xss')</script>",
    });
    expect(result.title).toBe("");
  });
});

describe("FormFileUploadSchema", () => {
  const thumbnailSizeMessage = `Thumbnails must not exceed ${MAX_THUMBNAIL_SIZE_BYTES / (1024 * 1024)} MB`;

  const makeUploadInput = () => ({
    description: "description",
    relatedPostId: undefined,
    source: undefined,
    tags: [],
    thumbnail: new File(["thumb"], "thumb.jpg", { type: "image/jpeg" }),
    title: "title",
    videoKey: "videos/user-1/abc.mp4",
    videoMetadata: undefined,
  });

  it("accepts a video key and JPEG thumbnail", () => {
    const input = makeUploadInput();
    const result = parseStrict(FormFileUploadSchema)(input);
    expect(result.videoKey).toBe("videos/user-1/abc.mp4");
    expect(result.thumbnail.name).toBe("thumb.jpg");
  });

  it("rejects a missing video key", () => {
    expect(() =>
      parseStrict(FormFileUploadSchema)({
        ...makeUploadInput(),
        videoKey: "",
      }),
    ).toThrow("Video upload is missing");
  });

  it("rejects a thumbnail that is not a JPEG", () => {
    expect(() =>
      parseStrict(FormFileUploadSchema)({
        ...makeUploadInput(),
        thumbnail: new File(["thumb"], "thumb.png", {
          type: "image/png",
        }),
      }),
    ).toThrow("Thumbnail must be a JPEG image");
  });

  it("rejects a thumbnail larger than the size cap", () => {
    expect(() =>
      parseStrict(FormFileUploadSchema)({
        ...makeUploadInput(),
        thumbnail: new File(
          [new Uint8Array(MAX_THUMBNAIL_SIZE_BYTES + 1)],
          "thumb.jpg",
          { type: "image/jpeg" },
        ),
      }),
    ).toThrow(thumbnailSizeMessage);
  });
});
