import {
  Box,
  Button,
  Field,
  FileUpload,
  Grid,
  Icon,
  Image,
  Input,
  Text,
} from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createLazyFileRoute,
  useBlocker,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import type { MediaInfo } from "mediainfo.js";
import mediaInfoFactory from "mediainfo.js";
import { useEffect, useRef, useState } from "react";
import { LuCamera, LuUpload } from "react-icons/lu";
import { FieldInfo } from "src/components/form/FieldInfo";
import { FormTextWrapper } from "src/components/form/FieldText";
import { TagInput } from "src/components/ui/tag-input";
import { toaster } from "src/components/ui/toaster";
import { Video } from "src/components/Video";
import { eq } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { uploadDraftCollection } from "src/lib/db/collections";
import { postsKeys } from "src/lib/posts/posts.queries";
import { FormFileUploadSchema } from "src/lib/posts/posts.schema";
import type { FileUploadData, VideoMetadata } from "src/lib/posts/posts.schema";
import { searchPosts, uploadPost } from "src/lib/posts/posts.service";
import {
  analyzeVideo,
  buildFormData,
  generateAutoThumbnails,
  generateThumbnails,
  type GeneratedThumbnail,
} from "src/lib/upload/upload.processor";

export const Route = createLazyFileRoute("/upload")({
  component: RouteComponent,
  pendingComponent: () => (
    <Box maxW="xl" mx="auto" px={4} py={8}>
      <Text>Loading upload form...</Text>
    </Box>
  ),
});

function RouteComponent() {
  const { user } = Route.useRouteContext() as { user: any };
  const { queryClient } = useRouteContext({ from: "/upload" });
  const [videoFilePreview, setVideoPreviewUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const mediaInfoRef = useRef<MediaInfo<"JSON"> | null>(null);
  const frameRateRef = useRef<number | null>(null);
  const videoRef = useRef<any>(null);

  const { data: draftEntries } = useLiveQuery((query) =>
    query
      .from({ draft: uploadDraftCollection })
      .where(({ draft }) => eq(draft.id, "upload-draft")),
  );
  const draft = draftEntries[0];
  const [savedVideoName, setSavedVideoName] = useState<string | null>(
    () => draft?.videoName ?? null,
  );

  const draftLoadedRef = useRef(false);

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
      uploadDraftCollection.delete("upload-draft");
      setSavedVideoName(null);
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

  const [thumbnails, setThumbnails] = useState<GeneratedThumbnail[]>([]);
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] =
    useState<number>(0);

  const handleCapture = async () => {
    const videoFile = form.getFieldValue("video");
    const player = videoRef.current;
    if (!videoFile || !player || !player.media) {
      toaster.create({
        description: "Could not determine the current time from the player.",
        duration: 3000,
        title: "Capture failed",
        type: "error",
      });
      return;
    }

    const time = player.media.currentTime;

    try {
      const generated = await generateThumbnails(videoFile, [time]);
      if (generated.length > 0) {
        setThumbnails((prev) => {
          const newThumbs = [...prev, ...generated];
          setSelectedThumbnailIndex(newThumbs.length - 1);
          return newThumbs;
        });
        form.setFieldValue("thumbnail", generated[0].file);
        toaster.create({
          description: "Thumbnail captured successfully.",
          duration: 3000,
          title: "Captured",
          type: "success",
        });
      }
    } catch (error) {
      console.error("Failed to capture thumbnail:", error);
      toaster.create({
        description: "There was an error capturing the frame.",
        duration: 3000,
        title: "Capture failed",
        type: "error",
      });
    }
  };

  const handleSubmit = async (values: FileUploadData): Promise<void> => {
    const formData = buildFormData(values);
    await uploadPostMutation.mutateAsync(formData);
  };

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

  const form = useForm({
    defaultValues: {
      content: draft?.content ?? "",
      relatedPostId: draft?.relatedPostId ?? (undefined as number | undefined),
      source: draft?.source ?? (undefined as string | undefined),
      tags: (draft?.tags ?? []) as { id?: number; name: string }[],
      thumbnail: undefined as unknown as File,
      title: draft?.title ?? "",
      userId: user?.id ?? "",
      video: undefined as unknown as File,
      videoMetadata: undefined as VideoMetadata,
    },
    onSubmit: async ({ value }) => {
      await handleSubmit(value);
    },
    validators: {
      // fix typing lint issue
      onSubmit: ({ value }) => {
        const result = FormFileUploadSchema.safeParse(value);
        if (!result.success) {
          return result.error.issues.map((i) => i.message).join(", ");
        }
        return undefined;
      },
    },
  });

  useEffect(() => {
    if (draft && !draftLoadedRef.current) {
      draftLoadedRef.current = true;
      form.reset(
        {
          content: draft.content,
          relatedPostId: draft.relatedPostId,
          source: draft.source,
          tags: draft.tags,
          thumbnail: undefined as unknown as File,
          title: draft.title,
          userId: user?.id ?? "",
          video: undefined as unknown as File,
          videoMetadata: undefined as VideoMetadata,
        },
        { keepDefaultValues: false },
      );
      setSavedVideoName(draft.videoName || null);
    }
  }, [draft, form, user?.id]);

  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const persistDraft = (values: typeof form.state.values) => {
    clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      const id = "upload-draft";
      const data = {
        content: values.content ?? "",
        id,
        relatedPostId: values.relatedPostId,
        source: values.source,
        tags: values.tags ?? [],
        title: values.title ?? "",
        videoName: values.video?.name ?? draft?.videoName ?? "",
      };

      if (uploadDraftCollection.state.get(id)) {
        uploadDraftCollection.update(id, (d) => {
          d.title = data.title;
          d.content = data.content;
          d.source = data.source;
          d.relatedPostId = data.relatedPostId;
          d.tags = data.tags;
          d.videoName = data.videoName;
        });
      } else {
        uploadDraftCollection.insert(data);
      }
    }, 500);
  };

  const [relatedPostSearch, setRelatedPostSearch] = useState("");
  const { data: relatedPosts } = useQuery({
    enabled: relatedPostSearch.length > 2,
    queryFn: async () =>
      searchPosts({
        data: { page: 0, q: relatedPostSearch, tags: [] as string[] },
      }),
    queryKey: postsKeys.search({
      dateRange: "all",
      page: 0,
      q: relatedPostSearch,
      sortBy: "newest",
      tags: [],
    }),
  });

  return (
    <Box maxW="xl" mx="auto" px={4} py={8}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
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
                  onChange={(e) => {
                    setRelatedPostSearch(e.target.value);
                  }}
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
                    {relatedPosts.data.map(
                      (post: {
                        id: number;
                        title: string;
                        content: string;
                      }) => (
                        <Box
                          _hover={{ bg: "gray.100" }}
                          borderRadius="sm"
                          cursor="pointer"
                          key={post.id}
                          onClick={() => {
                            field.handleChange(Number(post.id));
                            setRelatedPostSearch(post.title);
                          }}
                          p={2}
                        >
                          <Text fontWeight="medium">{post.title}</Text>
                          <Text color="gray.600" fontSize="sm">
                            {post.content.slice(0, 60)}...
                          </Text>
                        </Box>
                      ),
                    )}
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
                  onChange={(newTags) => {
                    field.handleChange(newTags);
                  }}
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
                        setSavedVideoName(null);
                        const previewURL = URL.createObjectURL(file);
                        setVideoPreviewUrl(previewURL);

                        if (mediaInfoRef.current) {
                          void analyzeVideo(file, mediaInfoRef.current)
                            .then((parsedData) => {
                              frameRateRef.current =
                                parsedData?.FrameRate ?? null;
                              form.setFieldValue("videoMetadata", parsedData);
                            })
                            .catch((error: unknown) => {
                              console.error(
                                "MediaInfo analysis failed:",
                                error,
                              );
                              toaster.create({
                                description:
                                  "Could not extract video metadata.",
                                duration: 3000,
                                title: "MediaInfo failed",
                                type: "warning",
                              });
                            });
                        }

                        try {
                          const generated = await generateAutoThumbnails(file);
                          setThumbnails(generated);
                          if (generated.length > 0) {
                            setSelectedThumbnailIndex(0);
                            form.setFieldValue("thumbnail", generated[0].file);
                          }
                        } catch (error) {
                          console.error(
                            "Failed to generate thumbnails:",
                            error,
                          );
                          toaster.create({
                            description: "Please try re-uploading the video.",
                            duration: 3000,
                            title: "Thumbnail generation failed",
                            type: "error",
                          });
                        }
                        return;
                      }
                      setVideoPreviewUrl(null);
                      setThumbnails([]);
                    }}
                  >
                    <FileUpload.HiddenInput />
                    {!field.state.value && (
                      <>
                        <FileUpload.Dropzone minHeight="32">
                          <Icon color="fg.muted" size="md">
                            <LuUpload />
                          </Icon>
                          <FileUpload.DropzoneContent>
                            <Box>Drag and drop files here</Box>
                            <Box color="fg.muted">.mp4, .mov, .mkv</Box>
                          </FileUpload.DropzoneContent>
                        </FileUpload.Dropzone>
                        {savedVideoName && (
                          <Text color="gray.500" fontSize="sm" mt={1}>
                            Previously selected: {savedVideoName}
                          </Text>
                        )}
                      </>
                    )}
                    <FileUpload.List clearable showSize />
                  </FileUpload.Root>
                  {videoFilePreview && (
                    <>
                      <Video
                        bypass
                        frameRate={frameRateRef.current ?? undefined}
                        ref={videoRef}
                        url={videoFilePreview}
                      />
                      <Box mt={4}>
                        <Box
                          alignItems="center"
                          display="flex"
                          justifyContent="space-between"
                          mb={2}
                        >
                          <Text fontWeight="bold">Select Thumbnail:</Text>
                          <Button
                            onClick={handleCapture}
                            size="sm"
                            variant="outline"
                          >
                            <LuCamera style={{ marginRight: "8px" }} />
                            Capture Current Frame
                          </Button>
                        </Box>
                        {thumbnails.length > 0 && (
                          <Grid gap={2} templateColumns="repeat(5, 1fr)">
                            {thumbnails.map((thumb, index) => (
                              <Box
                                border="4px solid"
                                borderColor={
                                  selectedThumbnailIndex === index
                                    ? "blue.500"
                                    : "transparent"
                                }
                                borderRadius="md"
                                cursor="pointer"
                                key={thumb.url}
                                onClick={() => {
                                  setSelectedThumbnailIndex(index);
                                  form.setFieldValue("thumbnail", thumb.file);
                                }}
                                overflow="hidden"
                                transition="border-color 0.2s"
                              >
                                <Image
                                  alt={`Thumbnail ${index + 1}`}
                                  src={thumb.url}
                                />
                              </Box>
                            ))}
                          </Grid>
                        )}
                      </Box>
                    </>
                  )}
                </Field.Root>
                <FieldInfo field={field} />
              </>
            )}
          </form.Field>
        </Box>

        <form.Subscribe selector={(state) => state.values}>
          {(values) => {
            persistDraft(values);
            return null;
          }}
        </form.Subscribe>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting, state.isPristine]}
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

        <form.Subscribe selector={(state) => state.errors}>
          {(errors) =>
            errors.length > 0 ? (
              <Text color="red.500" fontSize="sm" mt={2}>
                {errors.join(", ")}
              </Text>
            ) : null
          }
        </form.Subscribe>
      </form>
    </Box>
  );
}
