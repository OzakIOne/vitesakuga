import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBlocker, useNavigate } from "@tanstack/react-router";

import { toaster } from "../../components/ui/toaster";
import { postsKeys } from "../posts/posts.queries";
import { FormFileUploadSchema } from "../posts/posts.schema";
import type { VideoMetadata } from "../posts/posts.schema";
import { uploadPost } from "../posts/posts.service";
import { buildFormData } from "./upload.processor";
import type { UploadDraftData } from "./useUploadDraft";

type UseUploadFormParams = {
  draft: UploadDraftData | null;
  userId: string;
  videoFile: File | null;
  thumbnail: File | undefined;
  videoMetadata: VideoMetadata | undefined;
  onDraftClear: () => void;
};

export function useUploadForm(params: UseUploadFormParams) {
  const { draft, userId, videoFile, thumbnail, videoMetadata, onDraftClear } =
    params;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const uploadPostMutation = useMutation({
    mutationFn: async (data: FormData) => uploadPost({ data }),
    onError: (error) => {
      console.error("Upload failed:", error);
      toaster.create({
        description: "There was an error uploading your post.",
        duration: 5000,
        title: "Upload failed",
        type: "error",
      });
    },
    onSuccess: (newPost) => {
      form.reset();
      onDraftClear();
      void queryClient.invalidateQueries({ queryKey: postsKeys.all });
      void navigate({ to: `/posts/${newPost.id}` });
      toaster.create({
        description: "Your post has been uploaded successfully.",
        duration: 5000,
        title: "Upload successful",
        type: "success",
      });
    },
  });

  const form = useForm({
    defaultValues: {
      content: draft?.content ?? "",
      relatedPostId: draft?.relatedPostId as number | undefined,
      source: draft?.source as string | undefined,
      tags: (draft?.tags ?? []) as { id?: number | undefined; name: string }[],
      thumbnail: undefined as unknown as File,
      title: draft?.title ?? "",
      userId,
      video: undefined as unknown as File,
      videoMetadata: undefined as VideoMetadata,
    },
    onSubmit: async ({ value }) => {
      const formData = buildFormData(value);
      await uploadPostMutation.mutateAsync(formData);
    },
    validators: {
      onChange: FormFileUploadSchema,
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
    form.setFieldValue("userId", userId);
    await form.handleSubmit();
  };

  return {
    form,
    isSubmitting: uploadPostMutation.isPending,
    submit,
  };
}
