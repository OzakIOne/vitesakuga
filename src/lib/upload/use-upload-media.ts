import { useCallback, useEffect, useRef, useState } from "react";

import {
  getImageFileValidationError,
  MAX_IMAGES_PER_POST,
} from "../posts/posts.schema";
import { useVideoProcessing } from "./useVideoProcessing";

export type UploadMediaKind = "image" | "video";

type RejectedImageFile = {
  file: File;
  errors: readonly string[];
};

type UseUploadMediaParams = {
  onSelectionChanged: () => void;
};

type UseUploadMediaResult = {
  mediaKind: UploadMediaKind;
  setMediaKind: (kind: UploadMediaKind) => void;
  imageFiles: File[];
  imageValidationErrors: { fileKey: string; message: string }[];
  imageKeyFor: (file: File) => string;
  imagePreviewUrlFor: (file: File) => string | undefined;
  onImageFilesChange: (selection: {
    acceptedFiles: File[];
    rejectedFiles: RejectedImageFile[];
  }) => void;
  moveImage: (from: number, to: number) => void;
  removeImage: (index: number) => void;
  video: ReturnType<typeof useVideoProcessing>;
  getSelectionVersion: () => number;
};

const imageFileKey = (file: File): string =>
  `${file.name}:${file.size}:${file.lastModified}`;

const formatImageRejection = (
  file: File,
  errors: readonly string[],
): string => {
  const validationError = getImageFileValidationError(file);
  if (validationError) {
    return validationError;
  }
  if (errors.includes("TOO_MANY_FILES")) {
    return `You can select up to ${MAX_IMAGES_PER_POST} images per post`;
  }
  return "This image could not be selected";
};

export const useUploadMedia = ({
  onSelectionChanged,
}: UseUploadMediaParams): UseUploadMediaResult => {
  const [mediaKind, setMediaKind] = useState<UploadMediaKind>("video");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageValidationErrorsByFile, setImageValidationErrors] = useState<
    Record<string, string>
  >({});
  const [imagePreviewUrls, setImagePreviewUrls] = useState<
    Record<string, string>
  >({});
  const imagePreviewUrlsRef = useRef(imagePreviewUrls);
  const selectionVersionRef = useRef(0);
  const video = useVideoProcessing();
  const {
    captureFrame: captureVideoFrame,
    clearFile: clearVideoFileFromProcessor,
    selectFile: selectVideoFileInProcessor,
    selectThumbnail: selectVideoThumbnailInProcessor,
    selectedThumbnailIndex,
  } = video;

  const advanceSelectionVersion = useCallback(() => {
    selectionVersionRef.current += 1;
    onSelectionChanged();
  }, [onSelectionChanged]);

  const getSelectionVersion = useCallback(
    () => selectionVersionRef.current,
    [],
  );

  const changeMediaKind = useCallback(
    (kind: UploadMediaKind) => {
      if (kind === mediaKind) {
        return;
      }
      advanceSelectionVersion();
      setMediaKind(kind);
    },
    [advanceSelectionVersion, mediaKind],
  );

  const selectVideoFile = useCallback(
    async (file: File) => {
      advanceSelectionVersion();
      await selectVideoFileInProcessor(file);
    },
    [advanceSelectionVersion, selectVideoFileInProcessor],
  );

  const clearVideoFile = useCallback(() => {
    advanceSelectionVersion();
    clearVideoFileFromProcessor();
  }, [advanceSelectionVersion, clearVideoFileFromProcessor]);

  const captureFrame = useCallback(
    async (currentTime: number) => {
      advanceSelectionVersion();
      await captureVideoFrame(currentTime);
    },
    [advanceSelectionVersion, captureVideoFrame],
  );

  const selectThumbnail = useCallback(
    (index: number) => {
      if (index !== selectedThumbnailIndex) {
        advanceSelectionVersion();
      }
      selectVideoThumbnailInProcessor(index);
    },
    [
      advanceSelectionVersion,
      selectVideoThumbnailInProcessor,
      selectedThumbnailIndex,
    ],
  );

  useEffect(
    () => () => {
      for (const url of Object.values(imagePreviewUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
    },
    [],
  );

  const imageKeyFor = useCallback((file: File) => imageFileKey(file), []);

  const imagePreviewUrlFor = useCallback(
    (file: File) => imagePreviewUrls[imageFileKey(file)],
    [imagePreviewUrls],
  );

  const onImageFilesChange = useCallback(
    ({
      acceptedFiles,
      rejectedFiles,
    }: {
      acceptedFiles: File[];
      rejectedFiles: RejectedImageFile[];
    }) => {
      advanceSelectionVersion();
      setImageFiles(acceptedFiles);

      const current = imagePreviewUrlsRef.current;
      const next: Record<string, string> = {};
      const activeKeys = new Set<string>();
      for (const file of acceptedFiles) {
        const key = imageFileKey(file);
        activeKeys.add(key);
        next[key] = current[key] ?? URL.createObjectURL(file);
      }
      for (const [key, url] of Object.entries(current)) {
        if (!activeKeys.has(key)) {
          URL.revokeObjectURL(url);
        }
      }
      imagePreviewUrlsRef.current = next;
      setImagePreviewUrls(next);

      setImageValidationErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        for (const file of acceptedFiles) {
          delete nextErrors[imageFileKey(file)];
        }
        for (const rejection of rejectedFiles) {
          nextErrors[imageFileKey(rejection.file)] = formatImageRejection(
            rejection.file,
            rejection.errors,
          );
        }
        return nextErrors;
      });
    },
    [advanceSelectionVersion],
  );

  const moveImage = useCallback(
    (from: number, to: number) => {
      if (
        from < 0 ||
        from >= imageFiles.length ||
        to < 0 ||
        to >= imageFiles.length ||
        from === to
      ) {
        return;
      }
      advanceSelectionVersion();
      setImageFiles((current) => {
        if (from >= current.length || to >= current.length) {
          return current;
        }
        const next = [...current];
        const [file] = next.splice(from, 1);
        if (file) {
          next.splice(to, 0, file);
        }
        return next;
      });
    },
    [advanceSelectionVersion, imageFiles.length],
  );

  const removeImage = useCallback(
    (index: number) => {
      const file = imageFiles[index];
      if (!file) {
        return;
      }
      advanceSelectionVersion();
      const key = imageFileKey(file);
      setImageFiles((current) =>
        current.filter((_, itemIndex) => itemIndex !== index),
      );
      setImageValidationErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });

      const nextPreviewUrls = { ...imagePreviewUrlsRef.current };
      const url = nextPreviewUrls[key];
      if (url) {
        URL.revokeObjectURL(url);
        delete nextPreviewUrls[key];
        imagePreviewUrlsRef.current = nextPreviewUrls;
        setImagePreviewUrls(nextPreviewUrls);
      }
    },
    [advanceSelectionVersion, imageFiles],
  );

  return {
    imageFiles,
    imageKeyFor,
    imagePreviewUrlFor,
    imageValidationErrors: Object.entries(imageValidationErrorsByFile).map(
      ([fileKey, message]) => ({ fileKey, message }),
    ),
    mediaKind,
    moveImage,
    onImageFilesChange,
    removeImage,
    setMediaKind: changeMediaKind,
    video: {
      ...video,
      captureFrame,
      clearFile: clearVideoFile,
      selectFile: selectVideoFile,
      selectThumbnail,
    },
    getSelectionVersion,
  };
};
