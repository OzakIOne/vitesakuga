import type { MediaInfo } from "mediainfo.js";
import mediaInfoFactory from "mediainfo.js";
import { useEffect, useReducer, useRef, useState } from "react";
import { toaster } from "src/components/ui/toaster";

import { MAX_VIDEO_SIZE_BYTES } from "../posts/posts.schema";
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

type ThumbnailSelectionState = {
  thumbnails: GeneratedThumbnail[];
  selectedThumbnailIndex: number;
};

type ThumbnailSelectionAction =
  | { type: "set"; thumbnails: GeneratedThumbnail[] }
  | { type: "append"; generated: GeneratedThumbnail[] }
  | { type: "select"; index: number };

function thumbnailSelectionReducer(
  state: ThumbnailSelectionState,
  action: ThumbnailSelectionAction,
): ThumbnailSelectionState {
  switch (action.type) {
    case "set":
      return { thumbnails: action.thumbnails, selectedThumbnailIndex: 0 };
    case "append": {
      const thumbnails = [...state.thumbnails, ...action.generated];
      return {
        thumbnails,
        selectedThumbnailIndex: thumbnails.length - 1,
      };
    }
    case "select":
      return { ...state, selectedThumbnailIndex: action.index };
    default:
      return state;
  }
}

export function useVideoProcessing(): VideoProcessingState &
  VideoProcessingActions {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [frameRate, setFrameRate] = useState<number | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | undefined>(
    undefined,
  );
  const [thumbnailState, dispatchThumbnails] = useReducer(
    thumbnailSelectionReducer,
    { thumbnails: [], selectedThumbnailIndex: 0 },
  );
  const { thumbnails, selectedThumbnailIndex } = thumbnailState;

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
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      toaster.create({
        description: `Video files must not exceed ${MAX_VIDEO_SIZE_BYTES / (1024 * 1024)} MB`,
        duration: 5000,
        title: "Video too large",
        type: "error",
      });
      return;
    }

    setVideoFile(file);
    setVideoMetadata(undefined);
    setFrameRate(null);
    dispatchThumbnails({ type: "set", thumbnails: [] });

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
      dispatchThumbnails({ type: "set", thumbnails: generated });
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
      dispatchThumbnails({ type: "append", generated });
    }
  };

  const selectThumbnail = (index: number) => {
    dispatchThumbnails({ type: "select", index });
  };

  const clearFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setVideoFile(null);
    setPreviewUrl(null);
    setFrameRate(null);
    setVideoMetadata(undefined);
    dispatchThumbnails({ type: "set", thumbnails: [] });
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
