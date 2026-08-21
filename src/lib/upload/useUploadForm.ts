import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { safeParseStrict } from "../effect/schema.utils";
import {
  toastError,
  useMutationWithFeedback,
} from "../mutations/mutation-feedback";
import { postsKeys } from "../posts/posts.queries";
import {
  FormFileUploadSchema,
  MAX_VIDEO_SIZE_BYTES,
} from "../posts/posts.schema";
import type { Tag, VideoMetadata } from "../posts/posts.schema";
import { createVideoUploadUrl, uploadPost } from "../posts/posts.service";
import { buildFormData } from "./upload.processor";
import type { UploadDraftData } from "./useUploadDraft";

type UseUploadFormParams = {
  draft: UploadDraftData | null;
  videoFile: File | null;
  thumbnail: File | undefined;
  videoMetadata: VideoMetadata | undefined;
  onDraftClear: () => void;
};

type UploadFormValues = {
  content: string;
  relatedPostId: number | undefined;
  source: string | undefined;
  tags: Tag[];
  thumbnail: File | undefined;
  title: string;
  videoKey: string | undefined;
  videoMetadata: VideoMetadata | undefined;
};

export function useUploadForm(params: UseUploadFormParams) {
  const { draft, videoFile, thumbnail, videoMetadata, onDraftClear } = params;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  const uploadPostMutation = useMutationWithFeedback({
    errorFallback: "There was an error uploading your post.",
    errorTitle: "Upload failed",
    mutationFn: async (data: FormData) => uploadPost({ data }),
    onSuccess: (newPost) => {
      form.reset();
      onDraftClear();
      void queryClient.invalidateQueries({ queryKey: postsKeys.all });
      void navigate({ to: `/posts/${newPost.id}` });
    },
    successDescription: "Your post has been uploaded successfully.",
    successTitle: "Upload successful",
  });

  // The thumbnail file and videoKey are required by the submit schema but
  // start unset; `submit()` populates them right before handleSubmit (the
  // videoKey comes from the presigned direct-to-R2 upload), and the onSubmit
  // validator rejects the form until the user provides them.
  const defaultValues: UploadFormValues = {
    content: draft?.content ?? "",
    relatedPostId: draft?.relatedPostId,
    source: draft?.source,
    tags: draft?.tags ?? [],
    thumbnail: undefined,
    title: draft?.title ?? "",
    videoKey: undefined,
    videoMetadata: undefined,
  };

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      const formData = buildFormData(value);
      await uploadPostMutation.mutateAsync(formData);
    },
    validators: {
      onSubmit: ({ value }) => {
        const result = safeParseStrict(FormFileUploadSchema)(value);
        if (!result.success) {
          return result.message;
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

  const submit = async () => {
    if (thumbnail) {
      form.setFieldValue("thumbnail", thumbnail);
    }
    if (videoMetadata) {
      form.setFieldValue("videoMetadata", videoMetadata);
    }

    // The video bytes never transit the Worker: presign a direct-to-R2 PUT,
    // upload from the browser, then hand the resulting key to the confirm step.
    if (!videoFile) {
      return;
    }
    if (videoFile.size > MAX_VIDEO_SIZE_BYTES) {
      toastError(
        "Upload failed",
        new Error(
          `Video files must not exceed ${MAX_VIDEO_SIZE_BYTES / (1024 * 1024)} MB`,
        ),
        "There was an error uploading your post.",
      );
      return;
    }

    setIsUploadingVideo(true);
    try {
      const { contentType, key, url } = await createVideoUploadUrl({
        data: { fileName: videoFile.name },
      });
      const response = await fetch(url, {
        body: videoFile,
        headers: { "Content-Type": contentType },
        method: "PUT",
      });
      if (!response.ok) {
        throw new Error(`Storage upload failed with status ${response.status}`);
      }
      form.setFieldValue("videoKey", key);
    } catch (error) {
      toastError(
        "Upload failed",
        error,
        "There was an error uploading your post.",
      );
      return;
    } finally {
      setIsUploadingVideo(false);
    }

    await form.handleSubmit();
  };

  return {
    form,
    isSubmitting: uploadPostMutation.isPending || isUploadingVideo,
    submit,
  };
}
