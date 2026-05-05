import { describe, expect, it } from "vitest";
import { buildFormData, makeReadChunk } from "./upload.processor";
import type { FileUploadData } from "../posts/posts.schema";

const file = new File(["v"], "v.mp4", { type: "video/mp4" });
const thumb = new File(["t"], "t.jpg", { type: "image/jpeg" });

const baseValues: FileUploadData = {
  title: "My Post Title",
  content: "Some content here",
  userId: "user-1",
  source: "https://example.com",
  relatedPostId: undefined,
  tags: [],
  video: file,
  thumbnail: thumb,
  videoMetadata: undefined,
};

describe(buildFormData, () => {
  it("appends string values as FormData entries", () => {
    const formData = buildFormData(baseValues);

    expect(formData.get("title")).toBe("My Post Title");
    expect(formData.get("content")).toBe("Some content here");
    expect(formData.get("userId")).toBe("user-1");
    expect(formData.get("source")).toBe("https://example.com");
  });

  it("appends File values directly", () => {
    const formData = buildFormData(baseValues);

    expect(formData.get("video")).toBeInstanceOf(File);
    expect(formData.get("thumbnail")).toBeInstanceOf(File);
    expect((formData.get("video") as File).name).toBe("v.mp4");
  });

  it("appends arrays and objects as JSON strings", () => {
    const values = {
      ...baseValues,
      tags: [{ name: "anime" }, { id: 1, name: "action" }],
    };

    const formData = buildFormData(values);

    expect(formData.get("tags")).toBe(JSON.stringify(values.tags));
  });

  it("appends videoMetadata object as JSON string", () => {
    const metadata = { FrameRate: 24, Width: 1920 };
    const values = { ...baseValues, videoMetadata: metadata as never };

    const formData = buildFormData(values);

    expect(formData.get("videoMetadata")).toBe(JSON.stringify(metadata));
  });

  it("skips undefined values", () => {
    const formData = buildFormData(baseValues);

    expect(formData.has("relatedPostId")).toBe(false);
    expect(formData.has("videoMetadata")).toBe(false);
  });
});

describe(makeReadChunk, () => {
  it("returns a function that reads file chunks as Uint8Array", async () => {
    const content = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const file = new File([content], "test.bin");

    const readChunk = makeReadChunk(file);
    const result = await readChunk(5, 2);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(5);
    expect(result[0]).toBe(2);
    expect(result[4]).toBe(6);
  });

  it("reads partial chunk at end of file", async () => {
    const content = new Uint8Array([10, 20, 30, 40, 50]);
    const file = new File([content], "test.bin");

    const readChunk = makeReadChunk(file);
    const result = await readChunk(3, 3);

    expect(result.length).toBe(2);
    expect(result[0]).toBe(40);
    expect(result[1]).toBe(50);
  });
});
