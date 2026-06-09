import type { MediaInfo } from "mediainfo.js";
import mediaInfoFactory from "mediainfo.js";
import { useEffect, useRef, useState } from "react";
import { toaster } from "src/components/ui/toaster";

import type { VideoMetadata } from "../posts/posts.schema";
import {
  analyzeVideo,
  generateAutoThumbnails,
  generateThumbnails,
  type GeneratedThumbnail,
} from "./upload.processor";

type VideoProcessingState = {
  videoFile: File | null;
  previewUrl: string | null;
  frameRate: number | null;
  thumbnails: GeneratedThumbnail[];
  selectedThumbnailIndex: number;
  videoMetadata: VideoMetadata | undefined;
};

type VideoProcessingActions = {
  selectFile: (file: File) => Promise<void>;
  captureFrame: (currentTime: number) => Promise<void>;
  selectThumbnail: (index: number) => void;
  clearFile: () => void;
};

export function useVideoProcessing(): VideoProcessingState &
  VideoProcessingActions {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [frameRate, setFrameRate] = useState<number | null>(null);
  const [thumbnails, setThumbnails] = useState<GeneratedThumbnail[]>([]);
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState(0);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | undefined>(
    undefined,
  );

  const mediaInfoRef = useRef<MediaInfo<"JSON"> | null>(null);

  useEffect(() => {
    void mediaInfoFactory({
      format: "JSON",
      locateFile: () => "/MediaInfoModule.wasm",
    }).then((mi) => {
      mediaInfoRef.current = mi;
    });

    return () => {
      if (mediaInfoRef.current) {
        mediaInfoRef.current.close();
      }
    };
  }, []);

  useEffect(
    () => () => {
      thumbnails.forEach((t) => URL.revokeObjectURL(t.url));
    },
    [thumbnails],
  );

  const selectFile = async (file: File) => {
    setVideoFile(file);
    setSelectedThumbnailIndex(0);
    setVideoMetadata(undefined);
    setFrameRate(null);
    setThumbnails([]);

    if (mediaInfoRef.current) {
      try {
        const parsedData = await analyzeVideo(file, mediaInfoRef.current);
        setFrameRate(parsedData?.FrameRate ?? null);
        setVideoMetadata(parsedData);
      } catch (error) {
        console.error("MediaInfo analysis failed:", error);
      }
    }

    try {
      const generated = await generateAutoThumbnails(file);
      setThumbnails(generated);
      if (generated.length > 0) {
        setSelectedThumbnailIndex(0);
      }
    } catch (error) {
      console.error("Thumbnail generation failed:", error);
      toaster.create({
        description:
          error instanceof Error
            ? error.message
            : "Please try re-uploading the video.",
        duration: 5000,
        title: "Thumbnail generation failed",
        type: "error",
      });
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const captureFrame = async (currentTime: number) => {
    if (!videoFile) {
      throw new Error("No video file selected");
    }

    if (!Number.isFinite(currentTime) || currentTime < 0) {
      throw new Error(`Invalid current time: ${currentTime}`);
    }

    const generated = await generateThumbnails(videoFile, [currentTime]);
    if (generated.length > 0) {
      setThumbnails((prev) => {
        const newThumbs = [...prev, ...generated];
        setSelectedThumbnailIndex(newThumbs.length - 1);
        return newThumbs;
      });
    }
  };

  const selectThumbnail = (index: number) => {
    setSelectedThumbnailIndex(index);
  };

  const clearFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setVideoFile(null);
    setPreviewUrl(null);
    setFrameRate(null);
    setThumbnails([]);
    setSelectedThumbnailIndex(0);
    setVideoMetadata(undefined);
  };

  return {
    captureFrame,
    clearFile,
    frameRate,
    previewUrl,
    selectFile,
    selectThumbnail,
    selectedThumbnailIndex,
    thumbnails,
    videoFile,
    videoMetadata,
  };
}
