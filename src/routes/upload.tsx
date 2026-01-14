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
  createFileRoute,
  useBlocker,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { MediaInfo, MediaInfoResult } from "mediainfo.js";
import mediaInfoFactory from "mediainfo.js";
import { useEffect, useRef, useState } from "react";
import { LuCamera, LuUpload } from "react-icons/lu";
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
  VideoMetadataSchema,
} from "src/lib/posts/posts.schema";
import { buildFormData, makeReadChunk } from "src/lib/posts/posts.utils";

type GeneratedThumbnail = {
  url: string;
  file: File;
};

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
  const mediaInfoRef = useRef<MediaInfo<"JSON"> | null>(null);
  const frameRateRef = useRef<number | null>(null);
  const videoRef = useRef<any>(null);

  const uploadPostMutation = useMutation({
    mutationFn: (data: FormData) => uploadPost({ data }),
    onError: (error) => {
      console.error("Upload failed:", error);
      toaster.create({
        description: "There was an error uploading your post.",
        duration: 5000,
        title: "Upload failed",
        type: "error",
      });
    },
    onSuccess: (newPost: any) => {
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

  const [thumbnails, setThumbnails] = useState<GeneratedThumbnail[]>([]);
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] =
    useState<number>(0);

  const generateThumbnailsAtTimestamps = async (
    videoFile: File,
    timestamps: number[],
  ): Promise<GeneratedThumbnail[]> => {
    const { Input, ALL_FORMATS, BlobSource, CanvasSink } = await import(
      "mediabunny"
    );
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(videoFile),
    });

    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error("No video track found");

    const sink = new CanvasSink(videoTrack, { width: 640 });
    const results: GeneratedThumbnail[] = [];

    for await (const result of sink.canvasesAtTimestamps(timestamps)) {
      const blob = await new Promise<Blob | null>(async (resolve) => {
        if ("convertToBlob" in result.canvas) {
          const b = await (result.canvas as OffscreenCanvas).convertToBlob({
            quality: 0.8,
            type: "image/jpeg",
          });
          resolve(b);
        } else {
          (result.canvas as HTMLCanvasElement).toBlob(
            (b) => resolve(b),
            "image/jpeg",
            0.8,
          );
        }
      });

      if (blob) {
        const file = new File(
          [blob],
          `thumbnail-${results.length}-${Date.now()}.jpg`,
          {
            type: "image/jpeg",
          },
        );
        results.push({
          file,
          url: URL.createObjectURL(blob),
        });
      }
    }
    return results;
  };

  const generateAutomaticThumbnails = async (videoFile: File) => {
    const { Input, ALL_FORMATS, BlobSource } = await import("mediabunny");
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(videoFile),
    });

    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error("No video track found");

    const startTimestamp = await videoTrack.getFirstTimestamp();
    const endTimestamp = await videoTrack.computeDuration();

    // Pick 5 timestamps
    const timestamps = [0.1, 0.3, 0.5, 0.7, 0.9].map(
      (t) => startTimestamp + t * (endTimestamp - startTimestamp),
    );

    return generateThumbnailsAtTimestamps(videoFile, timestamps);
  };

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
      const generated = await generateThumbnailsAtTimestamps(videoFile, [time]);
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
    mediaInfoFactory({
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

  useEffect(() => {
    return () => {
      thumbnails.forEach((t) => URL.revokeObjectURL(t.url));
    };
  }, [thumbnails]);

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

  // TODO fix those fucking types
  const form = useForm({
    defaultValues: {
      content: "",
      relatedPostId: undefined,
      source: "",
      tags: [],
      thumbnail: undefined as unknown as File,
      title: "",
      userId: user.id,
      video: undefined as unknown as File,
      videoMetadata: {} as any,
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
    queryKey: postsKeys.search(relatedPostSearch, []),
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
                      if (file && mediaInfoRef.current) {
                        const previewURL = URL.createObjectURL(file);
                        setVideoPreviewUrl(previewURL);
                        mediaInfoRef.current
                          .analyzeData(file.size, makeReadChunk(file))
                          .then((value) => {
                            const datajson: MediaInfoResult = JSON.parse(value);
                            const videoTrack = datajson.media?.track.find(
                              (el) => el["@type"] === "Video",
                            );
                            const parsedData =
                              VideoMetadataSchema.parse(videoTrack);
                            frameRateRef.current = parsedData.FrameRate;
                            form.setFieldValue("videoMetadata", parsedData);
                          })
                          .catch((error: unknown) => {
                            console.error(error);
                          });
                        // Auto-generate thumbnails
                        try {
                          const generated =
                            await generateAutomaticThumbnails(file);
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
                      <Video
                        bypass
                        frameRate={frameRateRef.current ?? undefined}
                        ref={videoRef}
                        url={videoFilePreview}
                      />

                      {thumbnails.length > 0 && (
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
                        </Box>
                      )}
                    </>
                  )}
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
