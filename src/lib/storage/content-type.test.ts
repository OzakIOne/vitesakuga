import { describe, expect, it } from "vitest";

import { THUMBNAIL_CONTENT_TYPE, videoContentType } from "./content-type";

describe("videoContentType", () => {
  it("maps each whitelisted extension to a video MIME type", () => {
    expect(videoContentType("mp4")).toBe("video/mp4");
    expect(videoContentType("mkv")).toBe("video/x-matroska");
    expect(videoContentType("mov")).toBe("video/quicktime");
    expect(videoContentType("avi")).toBe("video/x-msvideo");
    expect(videoContentType("flv")).toBe("video/x-flv");
    expect(videoContentType("wmv")).toBe("video/x-ms-wmv");
  });

  it("is case-insensitive", () => {
    expect(videoContentType("MKV")).toBe("video/x-matroska");
  });

  it("falls back to octet-stream for unknown extensions", () => {
    expect(videoContentType("txt")).toBe("application/octet-stream");
  });
});

describe("thumbnail content type", () => {
  it("is always JPEG", () => {
    expect(THUMBNAIL_CONTENT_TYPE).toBe("image/jpeg");
  });
});
