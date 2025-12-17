import {
  Box,
  Button,
  Field,
  FileUpload,
  Icon,
  Input,
  Text,
} from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  useBlocker,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { LuUpload } from "react-icons/lu";
import { FieldInfo } from "src/components/form/FieldInfo";
import { FormTextWrapper } from "src/components/form/FieldText";
import { TagInput } from "src/components/ui/tag-input";
import { toaster } from "src/components/ui/toaster";
import { Video } from "src/components/Video";
import {
  authMiddleware,
  type MiddlewareUser,
} from "src/lib/auth/auth.middleware";
import { searchPosts, uploadPost } from "src/lib/posts/posts.fn";
import { postsKeys } from "src/lib/posts/posts.queries";
import {
  type FileUploadData,
  FormFileUploadSchema,
  type SerializedUploadData,
} from "src/lib/posts/posts.schema";
import { transformUploadFormData } from "src/lib/posts/posts.utils";

export const Route = createFileRoute("/upload")({
  component: RouteComponent,
  server: {
    middleware: [authMiddleware],
  },
});

function RouteComponent() {
  const { user } = Route.useRouteContext() as MiddlewareUser;
  const { queryClient } = useRouteContext({ from: "/upload" });
  const [videoFilePreview, setVideoPreviewUrl] = useState<string | null>(null);
  const navigate = useNavigate({ from: "/posts" });

  const uploadPostFn = useServerFn(uploadPost);

  const uploadPostMutation = useMutation({
    mutationFn: (data: SerializedUploadData) => uploadPostFn({ data }),
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
      queryClient.invalidateQueries({ queryKey: postsKeys.all });
      navigate({ to: `/posts/${newPost.id}` });
      toaster.create({
        description: "Your post has been uploaded successfully.",
        duration: 5000,
        title: "Upload successful",
        type: "success",
      });
    },
  });

  const [thumbnail, setThumbnail] = useState<string | null>(null);

  const captureThumbnail = async () => {
    const video = document.querySelector("video");
    if (!video) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8),
    );
    if (!blob) return;

    const file = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });

    const previewUrl = URL.createObjectURL(blob);
    setThumbnail(previewUrl);

    form.setFieldValue("thumbnail", file);
  };

  useBlocker({
    enableBeforeUnload: true,
    shouldBlockFn: () => {
      if (!form.state.isDirty) return false;

      const shouldLeave = confirm(
        "You have unsubmitted changes. Do you want to leave?",
      );
      return !shouldLeave;
    },
  });

  const generateDefaultThumbnail = async (videoFile: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.src = URL.createObjectURL(videoFile);
      video.crossOrigin = "anonymous";

      const drawFrame = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to generate thumbnail"));
              return;
            }

            const file = new File([blob], "thumbnail.jpg", {
              type: "image/jpeg",
            });
            resolve(file);
            URL.revokeObjectURL(video.src);
          },
          "image/jpeg",
          0.8,
        );
      };

      video.onloadedmetadata = () => {
        video.currentTime = 0;
      };

      video.onseeked = () => {
        drawFrame();
      };

      video.onerror = () => {
        reject(new Error("Failed to load video"));
      };
    });
  };

  const handleSubmit = async (values: FileUploadData): Promise<void> => {
    try {
      const uploadData = await transformUploadFormData(values);
      await uploadPostMutation.mutateAsync(uploadData);
    } catch (error) {
      console.error("Upload failed:", error);
      toaster.create({
        description: "There was an error uploading your post.",
        duration: 5000,
        title: "Upload failed",
        type: "error",
      });
    }
  };

  const form = useForm({
    defaultValues: {
      content: "",
      relatedPostId: undefined,
      source: undefined,
      tags: [],
      thumbnail: undefined,
      title: "",
      userId: user.id,
      video: undefined,
    } as FileUploadData,
    onSubmit: async ({ value }) => {
      await handleSubmit(value);
    },
    validators: {
      onSubmit: FormFileUploadSchema,
    },
  });

  const [relatedPostSearch, setRelatedPostSearch] = useState("");
  const { data: relatedPosts } = useQuery({
    enabled: relatedPostSearch.length > 2,
    queryFn: () =>
      searchPosts({
        data: {
          page: { size: 5 },
          q: relatedPostSearch,
        },
      }),
    queryKey: postsKeys.search(relatedPostSearch),
  });

  return (
    <Box maxW="xl" mx="auto" py={8}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <Box mb={6}>
          <form.Field name="title">
            {(field) => (
              <FormTextWrapper field={field} isRequired label="Title" />
            )}
          </form.Field>
        </Box>

        <Box mb={6}>
          <form.Field name="content">
            {(field) => (
              <FormTextWrapper
                asTextarea
                field={field}
                helper="A brief description of the animation"
                isRequired
                label="Description"
              />
            )}
          </form.Field>
        </Box>

        <Box mb={6}>
          <form.Field name="source">
            {(field) => (
              <FormTextWrapper
                field={field}
                helper="Link to the original source (Twitter, YouTube, etc.)"
                label="Source URL"
              />
            )}
          </form.Field>
        </Box>

        <Box mb={6}>
          <form.Field name="relatedPostId">
            {(field) => (
              <Field.Root>
                <Field.Label>Related Post</Field.Label>
                <Input
                  onChange={(e) => setRelatedPostSearch(e.target.value)}
                  placeholder="Search for related posts..."
                  value={relatedPostSearch}
                />
                {relatedPosts && relatedPosts.data.length > 0 && (
                  <Box
                    border="1px"
                    borderColor="gray.200"
                    borderRadius="md"
                    maxH="200px"
                    mt={2}
                    overflowY="auto"
                    p={2}
                  >
                    {relatedPosts.data.map((post) => (
                      <Box
                        _hover={{ bg: "gray.100" }}
                        borderRadius="sm"
                        cursor="pointer"
                        key={post.id}
                        onClick={() => {
                          field.handleChange(Number(post.id)); // Convert to number
                          setRelatedPostSearch(post.title);
                        }}
                        p={2}
                      >
                        <Text fontWeight="medium">{post.title}</Text>
                        <Text color="gray.600" fontSize="sm">
                          {post.content.substring(0, 60)}...
                        </Text>
                      </Box>
                    ))}
                  </Box>
                )}
                {field.state.value && (
                  <Box bg="blue.50" borderRadius="md" mt={2} p={2}>
                    <Text fontSize="sm">
                      Selected Post ID: {field.state.value}
                    </Text>
                    <Button
                      mt={1}
                      onClick={() => {
                        field.handleChange(undefined);
                        setRelatedPostSearch("");
                      }}
                      size="sm"
                    >
                      Clear
                    </Button>
                  </Box>
                )}
              </Field.Root>
            )}
          </form.Field>
        </Box>

        <Box mb={6}>
          <form.Field name="tags">
            {(field) => (
              <Field.Root>
                <Field.Label>Tags</Field.Label>
                <TagInput
                  onChange={(newTags) => field.handleChange(newTags)}
                  value={field.state.value}
                />
              </Field.Root>
            )}
          </form.Field>
        </Box>

        <Box mb={6}>
          <form.Field name="video">
            {(field) => (
              <>
                <Field.Root required>
                  <Field.Label>
                    Video <Field.RequiredIndicator />
                  </Field.Label>
                  <FileUpload.Root
                    accept={["video/*,.mkv"]}
                    alignItems="stretch"
                    maxW="xl"
                    onFileChange={async (details) => {
                      const file = details.acceptedFiles[0] || null;
                      field.handleChange(file);
                      if (file) {
                        const previewURL = URL.createObjectURL(file);
                        setVideoPreviewUrl(previewURL);

                        // Auto-generate thumbnail from first frame
                        try {
                          const defaultThumbnail =
                            await generateDefaultThumbnail(file);
                          form.setFieldValue("thumbnail", defaultThumbnail);
                          const thumbnailPreview =
                            URL.createObjectURL(defaultThumbnail);
                          setThumbnail(thumbnailPreview);
                        } catch (error) {
                          console.error(
                            "Failed to auto-generate thumbnail:",
                            error,
                          );
                          toaster.create({
                            description:
                              "Please generate a thumbnail manually.",
                            duration: 3000,
                            title: "Thumbnail generation failed",
                            type: "error",
                          });
                        }
                        return;
                      }
                      setVideoPreviewUrl(null);
                    }}
                  >
                    <FileUpload.HiddenInput />
                    {!field.state.value && (
                      <FileUpload.Dropzone minHeight="32">
                        <Icon color="fg.muted" size="md">
                          <LuUpload />
                        </Icon>
                        <FileUpload.DropzoneContent>
                          <Box>Drag and drop files here</Box>
                          <Box color="fg.muted">.mp4, .mov, .mkv</Box>
                        </FileUpload.DropzoneContent>
                      </FileUpload.Dropzone>
                    )}
                    <FileUpload.List clearable showSize />
                  </FileUpload.Root>
                  {videoFilePreview && (
                    <>
                      <Video bypass url={videoFilePreview} />

                      <Button mt={3} onClick={captureThumbnail}>
                        Generate Thumbnail from Current Frame
                      </Button>

                      {thumbnail && (
                        <Box mt={3}>
                          <Text mb={1}>Thumbnail Preview:</Text>
                          <img
                            alt="Video thumbnail"
                            src={thumbnail}
                            style={{
                              border: "1px solid #ddd",
                              borderRadius: "8px",
                              width: "100%",
                            }}
                          />
                        </Box>
                      )}
                    </>
                  )}{" "}
                </Field.Root>
                <FieldInfo field={field} />
              </>
            )}
          </form.Field>
        </Box>

        <form.Subscribe
          selector={(state) => [
            state.canSubmit,
            state.isSubmitting,
            state.isPristine,
          ]}
        >
          {([canSubmit, isSubmitting, isPristine]) => (
            <Button
              colorScheme="blue"
              disabled={!canSubmit || isPristine}
              loading={isSubmitting}
              style={{ width: "100%" }}
              type="submit"
            >
              {isSubmitting ? "Uploading..." : "Upload"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </Box>
  );
}
