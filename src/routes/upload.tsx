import {
  Box,
  Button,
  Field,
  FileUpload,
  Icon,
  Input,
  Text,
  Textarea,
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
import { FieldInfo } from "src/components/FieldInfo";
import { TagInput } from "src/components/ui/tag-input";
import { toaster } from "src/components/ui/toaster";
import { Video } from "src/components/Video";
import {
  authMiddleware,
  type MiddlewareUser,
} from "src/lib/auth/auth.middleware";
import { searchPosts, uploadPost } from "src/lib/posts/posts.fn";
import {
  FileFormUploadSchema,
  type FileUploadData,
  type SerializedUploadData,
} from "src/lib/posts/posts.schema";
import { transformUploadFormData } from "src/lib/posts/posts.utils";

export const Route = createFileRoute("/upload")({
  server: {
    middleware: [authMiddleware],
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = Route.useRouteContext() as MiddlewareUser;
  const { queryClient } = useRouteContext({ from: "/upload" });
  const [videoFilePreview, setVideoPreviewUrl] = useState<string | null>(null);
  const navigate = useNavigate({ from: "/posts" });

  const uploadPostFn = useServerFn(uploadPost);

  const uploadPostMutation = useMutation({
    mutationFn: (data: SerializedUploadData) => uploadPostFn({ data }),
    onSuccess: (newPost) => {
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      navigate({ to: `/posts/${newPost.id}` });
      toaster.create({
        title: "Upload successful",
        description: "Your post has been uploaded successfully.",
        type: "success",
        duration: 5000,
      });
    },
    onError: (error) => {
      console.error("Upload failed:", error);
      toaster.create({
        title: "Upload failed",
        description: "There was an error uploading your post.",
        type: "error",
        duration: 5000,
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
    shouldBlockFn: () => {
      if (!form.state.isDirty) return false;

      const shouldLeave = confirm(
        "You have unsubmitted changes. Do you want to leave?",
      );
      return !shouldLeave;
    },
    enableBeforeUnload: true,
  });

  const handleSubmit = async (values: FileUploadData): Promise<void> => {
    try {
      const uploadData = await transformUploadFormData(values);
      await uploadPostMutation.mutateAsync(uploadData);
    } catch (error) {
      console.error("Upload failed:", error);
      toaster.create({
        title: "Upload failed",
        description: "There was an error uploading your post.",
        type: "error",
        duration: 5000,
      });
    }
  };

  const form = useForm({
    defaultValues: {
      title: "",
      content: "",
      source: undefined,
      relatedPostId: undefined,
      tags: [],
      userId: user.id,
      video: undefined,
      thumbnail: undefined,
    } as FileUploadData,
    validators: {
      onSubmit: FileFormUploadSchema,
    },
    onSubmit: async ({ value }) => {
      await handleSubmit(value);
    },
  });

  const [relatedPostSearch, setRelatedPostSearch] = useState("");
  const { data: relatedPosts } = useQuery({
    queryKey: ["posts", "search", relatedPostSearch],
    queryFn: () =>
      searchPosts({
        data: {
          q: relatedPostSearch,
          page: { size: 5 },
        },
      }),
    enabled: relatedPostSearch.length > 2,
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
              <>
                <Field.Root required>
                  <Field.Label>
                    Title <Field.RequiredIndicator />
                  </Field.Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field.Root>
                <FieldInfo field={field} />
              </>
            )}
          </form.Field>
        </Box>

        <Box mb={6}>
          <form.Field name="content">
            {(field) => (
              <>
                <Field.Root required>
                  <Field.Label>
                    Description <Field.RequiredIndicator />
                  </Field.Label>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    rows={4}
                  />
                  <Field.HelperText>
                    A brief description of the animation
                  </Field.HelperText>
                </Field.Root>
                <FieldInfo field={field} />
              </>
            )}
          </form.Field>
        </Box>

        <Box mb={6}>
          <form.Field name="source">
            {(field) => (
              <>
                <Field.Root>
                  <Field.Label>Source URL</Field.Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value || ""}
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(e.target.value || undefined)
                    }
                  />
                  <Field.HelperText>
                    Link to the original source (Twitter, YouTube, etc.)
                  </Field.HelperText>
                </Field.Root>
                <FieldInfo field={field} />
              </>
            )}
          </form.Field>
        </Box>

        <Box mb={6}>
          <form.Field name="relatedPostId">
            {(field) => (
              <Field.Root>
                <Field.Label>Related Post</Field.Label>
                <Input
                  placeholder="Search for related posts..."
                  value={relatedPostSearch}
                  onChange={(e) => setRelatedPostSearch(e.target.value)}
                />
                {relatedPosts && relatedPosts.data.length > 0 && (
                  <Box
                    mt={2}
                    p={2}
                    border="1px"
                    borderColor="gray.200"
                    borderRadius="md"
                    maxH="200px"
                    overflowY="auto"
                  >
                    {relatedPosts.data.map((post) => (
                      <Box
                        key={post.id}
                        p={2}
                        cursor="pointer"
                        borderRadius="sm"
                        _hover={{ bg: "gray.100" }}
                        onClick={() => {
                          field.handleChange(Number(post.id)); // Convert to number
                          setRelatedPostSearch(post.title);
                        }}
                      >
                        <Text fontWeight="medium">{post.title}</Text>
                        <Text fontSize="sm" color="gray.600">
                          {post.content.substring(0, 60)}...
                        </Text>
                      </Box>
                    ))}
                  </Box>
                )}
                {field.state.value && (
                  <Box mt={2} p={2} bg="blue.50" borderRadius="md">
                    <Text fontSize="sm">
                      Selected Post ID: {field.state.value}
                    </Text>
                    <Button
                      size="sm"
                      mt={1}
                      onClick={() => {
                        field.handleChange(undefined);
                        setRelatedPostSearch("");
                      }}
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
                  value={field.state.value}
                  onChange={(newTags) => field.handleChange(newTags)}
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
                    maxW="xl"
                    alignItems="stretch"
                    accept={["video/*,.mkv"]}
                    onFileChange={(details) => {
                      const file = details.acceptedFiles[0] || null;
                      field.handleChange(file);
                      if (file) {
                        const previewURL = URL.createObjectURL(file);
                        setVideoPreviewUrl(previewURL);
                      } else {
                        setVideoPreviewUrl(null);
                      }
                    }}
                  >
                    <FileUpload.HiddenInput />
                    {!field.state.value && (
                      <FileUpload.Dropzone minHeight='32'>
                        <Icon size="md" color="fg.muted">
                          <LuUpload />
                        </Icon>
                        <FileUpload.DropzoneContent>
                          <Box>Drag and drop files here</Box>
                          <Box color="fg.muted">.mp4, .mov, .mkv</Box>
                        </FileUpload.DropzoneContent>
                      </FileUpload.Dropzone>
                    )}
                    <FileUpload.List showSize clearable />
                  </FileUpload.Root>
                  {videoFilePreview && (
                    <>
                      <Video url={videoFilePreview} bypass />

                      <Button mt={3} onClick={captureThumbnail}>
                        Generate Thumbnail from Current Frame
                      </Button>

                      {thumbnail && (
                        <Box mt={3}>
                          <Text mb={1}>Thumbnail Preview:</Text>
                          <img
                            src={thumbnail}
                            alt="Video thumbnail"
                            style={{
                              width: "100%",
                              borderRadius: "8px",
                              border: "1px solid #ddd",
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
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              colorScheme="blue"
              disabled={!canSubmit}
              loading={isSubmitting}
              style={{ width: "100%" }}
            >
              {isSubmitting ? "Uploading..." : "Upload"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </Box>
  );
}
