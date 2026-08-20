import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useBlocker, useNavigate } from "@tanstack/react-router";

import { safeParseStrict } from "../effect/schema.utils";
import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import { postsKeys } from "../posts/posts.queries";
import { FormFileUploadSchema } from "../posts/posts.schema";
import type { Tag, VideoMetadata } from "../posts/posts.schema";
import { uploadPost } from "../posts/posts.service";
import { buildFormData } from "./upload.processor";
import type { UploadDraftData } from "./useUploadDraft";

type UseUploadFormParams = {
  draft: UploadDraftData | null;
  videoFile: File | null;
  thumbnail: File | undefined;
  videoMetadata: VideoMetadata | undefined;
  onDraftClear: () => void;
};

export function useUploadForm(params: UseUploadFormParams) {
  const { draft, videoFile, thumbnail, videoMetadata, onDraftClear } = params;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  const form = useForm({
    defaultValues: {
      content: draft?.content ?? "",
      relatedPostId: draft?.relatedPostId as number | undefined,
      source: draft?.source as string | undefined,
      tags: (draft?.tags ?? []) as Tag[],
      thumbnail: undefined as unknown as File,
      title: draft?.title ?? "",
      video: undefined as unknown as File,
      videoMetadata: undefined as VideoMetadata,
    },
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
    if (videoFile) {
      form.setFieldValue("video", videoFile);
    }
    if (thumbnail) {
      form.setFieldValue("thumbnail", thumbnail);
    }
    if (videoMetadata) {
      form.setFieldValue("videoMetadata", videoMetadata);
    }
    await form.handleSubmit();
  };

  return {
    form,
    isSubmitting: uploadPostMutation.isPending,
    submit,
  };
}
