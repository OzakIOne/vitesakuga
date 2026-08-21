import { describe, expect, it } from "vitest";

import { MAX_VIDEO_SIZE_BYTES } from "../posts/posts.schema";
import type { UploadedFileHead } from "./storage.module";
import { isUploadedVideoValid } from "./upload-policy";

const validHead: UploadedFileHead = {
  contentLength: 1024,
  contentType: "video/mp4",
};

describe("isUploadedVideoValid", () => {
  it("accepts an object at the size cap with the expected content type", () => {
    expect(
      isUploadedVideoValid(
        { ...validHead, contentLength: MAX_VIDEO_SIZE_BYTES },
        "video/mp4",
      ),
    ).toBe(true);
  });

  it("rejects an object above the size cap", () => {
    expect(
      isUploadedVideoValid(
        { ...validHead, contentLength: MAX_VIDEO_SIZE_BYTES + 1 },
        "video/mp4",
      ),
    ).toBe(false);
  });

  it("rejects an empty object", () => {
    expect(
      isUploadedVideoValid({ ...validHead, contentLength: 0 }, "video/mp4"),
    ).toBe(false);
  });

  it("rejects a content type that does not match the signed extension", () => {
    expect(isUploadedVideoValid(validHead, "text/html")).toBe(false);
  });
});
