import { describe, expect, it } from "vitest";

import { assertThumbnailIsJpeg, hasJpegMagicBytes } from "./file-validation";

describe("file-validation", () => {
  it("detects a JPEG magic header", async () => {
    const file = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00])],
      "a.jpg",
    );
    await expect(hasJpegMagicBytes(file)).resolves.toBe(true);
  });

  it("rejects a PNG magic header", async () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "a.jpg");
    await expect(hasJpegMagicBytes(file)).resolves.toBe(false);
  });

  it("rejects an HTML payload disguised as a JPEG", async () => {
    const file = new File(["<!doctype html>"], "a.jpg");
    await expect(assertThumbnailIsJpeg(file)).rejects.toThrow(
      "Thumbnail is not a valid JPEG image",
    );
  });

  it("accepts a real JPEG payload", async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])], "a.jpg");
    await expect(assertThumbnailIsJpeg(file)).resolves.toBeUndefined();
  });
});
