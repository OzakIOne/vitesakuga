import type { MediaInfo, MediaInfoResult, ReadChunkFunc } from "mediainfo.js";

import { VideoMetadataSchema } from "../posts/posts.schema";
import type { VideoMetadata } from "../posts/posts.schema";

export type GeneratedThumbnail = {
  url: string;
  file: File;
};

export function makeReadChunk(file: File): ReadChunkFunc {
  return async (chunkSize: number, offset: number) =>
    new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer());
}

export function buildFormData<T extends Record<string, unknown>>(values: T) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (value instanceof File) {
      formData.append(key, value);
      continue;
    }

    if (Array.isArray(value) || typeof value === "object") {
      formData.append(key, JSON.stringify(value));
      continue;
    }

    // fix typing lint issue
    formData.append(key, String(value as string | number | boolean));
  }

  return formData;
}

export async function analyzeVideo(
  file: File,
  mediaInfo: MediaInfo<"JSON">,
): Promise<VideoMetadata> {
  const makeReadChunkFn = makeReadChunk(file);
  const rawResult = await mediaInfo.analyzeData(file.size, makeReadChunkFn);
  const parsed: MediaInfoResult = JSON.parse(rawResult);
  const videoTrack = parsed.media?.track.find((el) => el["@type"] === "Video");
  return VideoMetadataSchema.parse(videoTrack);
}

export async function generateThumbnails(
  videoFile: File,
  timestamps: number[],
): Promise<GeneratedThumbnail[]> {
  const { Input, ALL_FORMATS, BlobSource, CanvasSink } =
    await import("mediabunny");
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(videoFile),
  });

  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) {
    throw new Error("No video track found");
  }

  const decodable = await videoTrack.canDecode();
  if (!decodable) {
    throw new Error(
      "Your browser does not support decoding this video's codec. Thumbnails cannot be generated.",
    );
  }

  const sink = new CanvasSink(videoTrack, { width: 640 });
  const results: GeneratedThumbnail[] = [];

  for await (const result of sink.canvasesAtTimestamps(timestamps)) {
    if (!result) {
      continue;
    }
    const blob = await new Promise<Blob | null>((resolve) => {
      if ("convertToBlob" in result.canvas) {
        const b = result.canvas.convertToBlob({
          quality: 0.8,
          type: "image/jpeg",
        });
        resolve(b);
      } else {
        result.canvas.toBlob(
          (b) => {
            resolve(b);
          },
          "image/jpeg",
          0.8,
        );
      }
    });

    if (blob) {
      const file = new File(
        [blob],
        `thumbnail-${results.length}-${Date.now()}.jpg`,
        { type: "image/jpeg" },
      );
      results.push({ file, url: URL.createObjectURL(blob) });
    }
  }

  return results;
}

export async function generateAutoThumbnails(
  videoFile: File,
): Promise<GeneratedThumbnail[]> {
  const { Input, ALL_FORMATS, BlobSource } = await import("mediabunny");
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(videoFile),
  });

  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) {
    throw new Error("No video track found");
  }

  const decodable = await videoTrack.canDecode();
  if (!decodable) {
    throw new Error(
      "Your browser does not support decoding this video's codec. Thumbnails cannot be generated.",
    );
  }

  const startTimestamp = await videoTrack.getFirstTimestamp();
  const endTimestamp = await videoTrack.computeDuration();
  const timestamps = [0.1, 0.3, 0.5, 0.7, 0.9].map(
    (t) => startTimestamp + t * (endTimestamp - startTimestamp),
  );

  return generateThumbnails(videoFile, timestamps);
}
