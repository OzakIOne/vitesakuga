import { describe, expect, it } from "vitest";

import { parseSearchQuery } from "./search-filters";

describe("parseSearchQuery", () => {
  it("extracts booru-style numeric filters and keeps text search", () => {
    expect(parseSearchQuery("character width:>1000 likes:>10")).toEqual({
      filters: [
        { field: "width", operator: ">", value: 1000 },
        { field: "likes", operator: ">", value: 10 },
      ],
      text: "character",
    });
  });

  it("supports video dimensions", () => {
    expect(parseSearchQuery("video_width:=1920 video_height:<1080")).toEqual({
      filters: [
        { field: "video_width", operator: "=", value: 1920 },
        { field: "video_height", operator: "<", value: 1080 },
      ],
      text: "",
    });
  });

  it("leaves unsupported qualifiers in text search", () => {
    expect(parseSearchQuery("artist:foo width:nope width:>=200")).toEqual({
      filters: [],
      text: "artist:foo width:nope width:>=200",
    });
  });
});
