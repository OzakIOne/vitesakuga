import {
  useForm,
  type FormAsyncValidateOrFn,
  type FormValidateOrFn,
  type ReactFormExtendedApi,
} from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  safeParseStrictIssues,
  type SchemaFieldIssue,
} from "../effect/schema.utils";
import {
  toastError,
  useMutationWithFeedback,
} from "../mutations/mutation-feedback";
import { postsKeys } from "../posts/posts.queries";
import {
  FormFileUploadSchema,
  MAX_VIDEO_SIZE_BYTES,
  getImageFileValidationError,
} from "../posts/posts.schema";
import type { Tag, VideoMetadata } from "../posts/posts.schema";
import { createVideoUploadUrl, uploadPost } from "../posts/posts.service";
import { buildFormData, getImageDimensions } from "./upload.processor";
import { useUploadMedia } from "./use-upload-media";
import { useUploadDraft } from "./useUploadDraft";

type UploadFormValues = {
  operationKey: string;
  chapterNumber: number | undefined;
  description: string;
  episodeNumber: number | undefined;
  images: File[] | undefined;
  imageDimensions: { height: number; width: number }[] | undefined;
  relatedPostId: number | undefined;
  seasonNumber: number | undefined;
  source: string | undefined;
  tags: Tag[];
  thumbnail: File | undefined;
  title: string;
  videoKey: string | undefined;
  videoMetadata: VideoMetadata | undefined;
  volumeNumber: number | undefined;
};

/** TanStack Form validator error shape that addresses individual fields. */
export type FormValidationErrors = {
  form?: string;
  fields: Record<string, string>;
};

/**
 * Route schema failures to the fields they belong to, so TanStack Form can
 * display them inline next to the offending input instead of as one opaque
 * form-level blob. Top-level property paths (e.g. ["description"]) map to
 * that field; anything else (form-level checks, nested paths) becomes a form
 * error.
 */
export const toFormValidationErrors = (
  issues: SchemaFieldIssue[],
): FormValidationErrors => {
  const fields: Record<string, string> = {};
  const form: string[] = [];
  for (const issue of issues) {
    const [head, ...rest] = issue.path;
    if (head !== undefined && rest.length === 0) {
      fields[head] ??= issue.message;
    } else {
      form.push(
        issue.path.length > 0
          ? `${issue.message} at [${issue.path.map((segment) => JSON.stringify(segment)).join(", ")}]`
          : issue.message,
      );
    }
  }
  const result: FormValidationErrors = { fields };
  if (form.length > 0) {
    result.form = form.join("; ");
  }
  return result;
};

/**
 * The hook's return surface, annotated explicitly: the inferred
 * `ReactFormExtendedApi` type embeds validator types from
 * `@tanstack/form-core` (a transitive dependency), which would not be
 * nameable in an emitted declaration.
 */
type UseUploadFormResult = {
  form: ReactFormExtendedApi<
    UploadFormValues,
    FormValidateOrFn<UploadFormValues> | undefined,
    FormValidateOrFn<UploadFormValues> | undefined,
    FormAsyncValidateOrFn<UploadFormValues> | undefined,
    FormValidateOrFn<UploadFormValues> | undefined,
    FormAsyncValidateOrFn<UploadFormValues> | undefined,
    FormValidateOrFn<UploadFormValues> | undefined,
    FormAsyncValidateOrFn<UploadFormValues> | undefined,
    FormValidateOrFn<UploadFormValues> | undefined,
    FormAsyncValidateOrFn<UploadFormValues> | undefined,
    FormAsyncValidateOrFn<UploadFormValues> | undefined,
    unknown
  >;
  isSubmitting: boolean;
  submit: () => Promise<void>;
  draft: ReturnType<typeof useUploadDraft>;
  media: ReturnType<typeof useUploadMedia>;
};

export function useUploadForm(): UseUploadFormResult {
  const draft = useUploadDraft();
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const uploadGenerationRef = useRef(0);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const imagePreparationAbortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const cancelCurrentPreparation = useCallback(() => {
    uploadGenerationRef.current += 1;
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    imagePreparationAbortRef.current?.abort();
    imagePreparationAbortRef.current = null;
    setIsUploadingVideo(false);
    setIsPreparingImages(false);
  }, []);
  const media = useUploadMedia({
    onSelectionChanged: cancelCurrentPreparation,
  });
  const { mediaKind, video } = media;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      uploadGenerationRef.current += 1;
      uploadAbortRef.current?.abort();
      imagePreparationAbortRef.current?.abort();
    };
  }, []);

  const uploadPostMutation = useMutationWithFeedback({
    errorFallback: "There was an error uploading your post.",
    errorTitle: "Upload failed",
    mutationFn: async (data: FormData) => uploadPost({ data }),
    onSuccess: (newPost) => {
      form.reset(emptyValues);
      draft.clear();
      void queryClient.invalidateQueries({ queryKey: postsKeys.all });
      void navigate({ to: `/posts/${newPost.id}` });
    },
    successDescription: "Your post has been uploaded successfully.",
    successTitle: "Upload successful",
  });

  // The media file(s) are required by the submit schema but start unset;
  // `submit()` populates them right before handleSubmit. Videos go through
  // the presigned direct-to-R2 flow (videoKey + generated JPEG thumbnail);
  // image posts send their files through the Worker under "images".
  // Empty baseline for resets: resetting to `defaultValues` would re-fill the
  // form with the draft the post was built from, and the autosave would then
  // re-persist that draft right after a successful upload cleared it.
  const emptyValues: UploadFormValues = {
    operationKey: crypto.randomUUID(),
    chapterNumber: undefined,
    description: "",
    episodeNumber: undefined,
    images: undefined,
    imageDimensions: undefined,
    relatedPostId: undefined,
    seasonNumber: undefined,
    source: undefined,
    tags: [],
    thumbnail: undefined,
    title: "",
    videoKey: undefined,
    videoMetadata: undefined,
    volumeNumber: undefined,
  };

  const defaultValues: UploadFormValues = {
    ...emptyValues,
    operationKey: draft.draft?.operationKey ?? emptyValues.operationKey,
    chapterNumber: draft.draft?.chapterNumber,
    description: draft.draft?.description ?? "",
    relatedPostId: draft.draft?.relatedPostId,
    seasonNumber: draft.draft?.seasonNumber,
    source: draft.draft?.source,
    tags: draft.draft?.tags ?? [],
    title: draft.draft?.title ?? "",
    episodeNumber: draft.draft?.episodeNumber,
    volumeNumber: draft.draft?.volumeNumber,
  };

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      // The form value is already the submit shape; optional numeric
      // metadata (season/episode, volume/chapter) simply stays absent when
      // the user left it empty.
      const formData = buildFormData(value);
      await uploadPostMutation.mutateAsync(formData);
    },
    validators: {
      onSubmit: ({ value }) => {
        // TanStack Form keeps keys set to `undefined`, but the schema's
        // `optionalKey` fields require the key to be absent, so strip them.
        const definedEntries = Object.entries(value).filter(
          ([, v]) => v !== undefined,
        );
        const result = safeParseStrictIssues(FormFileUploadSchema)(
          Object.fromEntries(definedEntries),
        );
        if (!result.success) {
          // Field-addressable errors (e.g. ["description"]) are returned as a
          // `fields` map so they render inline next to the offending input.
          return toFormValidationErrors(result.issues);
        }
        return undefined;
      },
    },
  });

  useBlocker({
    enableBeforeUnload: true,
    shouldBlockFn: () => {
      if (!form.state.isDirty) {
        return false;
      }
      const shouldLeave = confirm(
        "You have unsubmitted changes. Do you want to leave?",
      );
      return !shouldLeave;
    },
  });

  const submitImagePost = async () => {
    const selectionVersion = media.getSelectionVersion();
    const { imageFiles } = media;
    form.setFieldValue("videoKey", undefined);
    form.setFieldValue("thumbnail", undefined);
    form.setFieldValue("videoMetadata", undefined);
    form.setFieldValue("images", undefined);
    form.setFieldValue("imageDimensions", undefined);
    if (imageFiles.length === 0) {
      return false;
    }

    const invalidImage = imageFiles
      .map((file) => ({
        file,
        error: getImageFileValidationError(file),
      }))
      .find(({ error }) => error !== undefined);
    if (invalidImage) {
      toastError(
        "Upload failed",
        new Error(`${invalidImage.file.name}: ${invalidImage.error}`),
        "There was an error uploading your post.",
      );
      return false;
    }

    imagePreparationAbortRef.current?.abort();
    const controller = new AbortController();
    imagePreparationAbortRef.current = controller;
    setIsPreparingImages(true);
    const isCurrent = () =>
      isMountedRef.current &&
      media.getSelectionVersion() === selectionVersion &&
      !controller.signal.aborted;

    let imageDimensions: { height: number; width: number }[];
    try {
      imageDimensions = await Promise.all(
        imageFiles.map(async (file) => {
          try {
            return await getImageDimensions(file, controller.signal);
          } catch {
            throw new Error(`${file.name} could not be read as an image`);
          }
        }),
      );
    } catch (error) {
      if (isCurrent()) {
        toastError(
          "Upload failed",
          error,
          "There was an error uploading your post.",
        );
      }
      return false;
    } finally {
      if (imagePreparationAbortRef.current === controller) {
        imagePreparationAbortRef.current = null;
        if (isMountedRef.current) {
          setIsPreparingImages(false);
        }
      }
    }
    if (!isCurrent()) {
      return false;
    }

    // The image transits the Worker like thumbnails do and doubles as the
    // post thumbnail server-side — no presigned flow or capture needed. The
    // array order is preserved so the first image remains the thumbnail.
    form.setFieldValue("images", imageFiles);
    form.setFieldValue("imageDimensions", imageDimensions);
    return true;
  };

  const submitVideoPost = async (): Promise<boolean> => {
    const generation = uploadGenerationRef.current + 1;
    uploadGenerationRef.current = generation;
    uploadAbortRef.current?.abort();
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    const selectionVersion = media.getSelectionVersion();
    const isCurrent = () =>
      isMountedRef.current &&
      uploadGenerationRef.current === generation &&
      media.getSelectionVersion() === selectionVersion &&
      !controller.signal.aborted;

    const { videoFile, thumbnails, selectedThumbnailIndex, videoMetadata } =
      video;
    const thumbnail = thumbnails[selectedThumbnailIndex]?.file;
    form.setFieldValue("images", undefined);
    form.setFieldValue("imageDimensions", undefined);
    form.setFieldValue("videoKey", undefined);
    form.setFieldValue("thumbnail", undefined);
    form.setFieldValue("videoMetadata", undefined);
    if (thumbnail) {
      form.setFieldValue("thumbnail", thumbnail);
    }
    if (videoMetadata) {
      form.setFieldValue("videoMetadata", videoMetadata);
    }

    // The video bytes never transit the Worker: presign a direct-to-R2 PUT,
    // upload from the browser, then hand the resulting key to the confirm step.
    if (!videoFile) {
      return false;
    }
    if (videoFile.size > MAX_VIDEO_SIZE_BYTES) {
      toastError(
        "Upload failed",
        new Error(
          `Video files must not exceed ${MAX_VIDEO_SIZE_BYTES / (1024 * 1024)} MB`,
        ),
        "There was an error uploading your post.",
      );
      return false;
    }

    setIsUploadingVideo(true);
    try {
      const { key, requiredHeaders, url } = await createVideoUploadUrl({
        data: {
          fileName: videoFile.name,
          operationKey: form.state.values.operationKey,
        },
      });
      if (!isCurrent()) return false;
      const response = await fetch(url, {
        body: videoFile,
        headers: requiredHeaders,
        method: "PUT",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Storage upload failed with status ${response.status}`);
      }
      if (!isCurrent()) return false;
      form.setFieldValue("videoKey", key);
    } catch (error) {
      if (controller.signal.aborted || !isCurrent()) return false;
      toastError(
        "Upload failed",
        error,
        "There was an error uploading your post.",
      );
      return false;
    } finally {
      if (isMountedRef.current && uploadGenerationRef.current === generation) {
        setIsUploadingVideo(false);
      }
    }
    return isCurrent();
  };

  const submit = async () => {
    const ready =
      mediaKind === "image" ? await submitImagePost() : await submitVideoPost();
    if (!ready) {
      return;
    }

    await form.handleSubmit();
  };

  return {
    form,
    isSubmitting:
      uploadPostMutation.isPending || isUploadingVideo || isPreparingImages,
    submit,
    draft,
    media,
  };
}
