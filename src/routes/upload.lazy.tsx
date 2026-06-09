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
import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { LuCamera, LuUpload } from "react-icons/lu";
import { FieldInfo } from "src/components/form/FieldInfo";
import { FormTextWrapper } from "src/components/form/FieldText";
import { TagInput } from "src/components/ui/tag-input";
import { toaster } from "src/components/ui/toaster";
import { Video } from "src/components/Video";
import { postsKeys } from "src/lib/posts/posts.queries";
import { searchPosts } from "src/lib/posts/posts.service";
import { useUploadDraft } from "src/lib/upload/useUploadDraft";
import { useUploadForm } from "src/lib/upload/useUploadForm";
import { useVideoProcessing } from "src/lib/upload/useVideoProcessing";

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

  const video = useVideoProcessing();
  const draft = useUploadDraft();

  const form = useUploadForm({
    draft: draft.draft,
    onDraftClear: draft.clear,
    thumbnail: video.thumbnails[video.selectedThumbnailIndex]?.file,
    userId: user?.id ?? "",
    videoFile: video.videoFile,
    videoMetadata: video.videoMetadata,
  });

  const videoRef = useRef<any>(null);

  const handleCapture = async () => {
    const player = videoRef.current;
    if (!player?.media) {
      toaster.create({
        description: "Could not determine the current time from the player.",
        duration: 3000,
        title: "Capture failed",
        type: "error",
      });
      return;
    }
    try {
      await video.captureFrame(player.media.currentTime);
      toaster.create({
        description: "Thumbnail captured successfully.",
        duration: 3000,
        title: "Captured",
        type: "success",
      });
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

  const handleFileChange = async (file: File | null) => {
    if (file) {
      await video.selectFile(file);
    } else {
      video.clearFile();
    }
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
          void form.submit();
        }}
      >
        <Box mb={6}>
          <form.form.Field name="title">
            {(field) => (
              <FormTextWrapper field={field} isRequired label="Title" />
            )}
          </form.form.Field>
        </Box>

        <Box mb={6}>
          <form.form.Field name="content">
            {(field) => (
              <FormTextWrapper
                asTextarea
                field={field}
                helper="A brief description of the animation"
                isRequired
                label="Description"
              />
            )}
          </form.form.Field>
        </Box>

        <Box mb={6}>
          <form.form.Field name="source">
            {(field) => (
              <FormTextWrapper
                field={field}
                helper="Link to the original source (Twitter, YouTube, etc.)"
                label="Source URL"
              />
            )}
          </form.form.Field>
        </Box>

        <Box mb={6}>
          <form.form.Field name="relatedPostId">
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
          </form.form.Field>
        </Box>

        <Box mb={6}>
          <form.form.Field name="tags">
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
          </form.form.Field>
        </Box>

        <Box mb={6}>
          <form.form.Field name="video">
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
                      await handleFileChange(file);
                    }}
                  >
                    <FileUpload.HiddenInput />
                    {!video.videoFile && (
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
                        {draft.draft?.videoName && (
                          <Text color="gray.500" fontSize="sm" mt={1}>
                            Previously selected: {draft.draft.videoName}
                          </Text>
                        )}
                      </>
                    )}
                    <FileUpload.List clearable showSize />
                  </FileUpload.Root>
                  {video.previewUrl && (
                    <>
                      <Video
                        bypass
                        frameRate={video.frameRate ?? undefined}
                        ref={videoRef}
                        url={video.previewUrl}
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
                        {video.thumbnails.length > 0 && (
                          <Grid gap={2} templateColumns="repeat(5, 1fr)">
                            {video.thumbnails.map((thumb, index) => (
                              <Box
                                border="4px solid"
                                borderColor={
                                  video.selectedThumbnailIndex === index
                                    ? "blue.500"
                                    : "transparent"
                                }
                                borderRadius="md"
                                cursor="pointer"
                                key={thumb.url}
                                onClick={() => {
                                  video.selectThumbnail(index);
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
          </form.form.Field>
        </Box>

        <form.form.Subscribe selector={(state) => state.values}>
          {(values) => {
            if (values.title || values.content) {
              draft.persist({
                content: values.content ?? "",
                relatedPostId: values.relatedPostId,
                source: values.source,
                tags: values.tags ?? [],
                title: values.title ?? "",
                videoName: video.videoFile?.name ?? draft.draft?.videoName ?? "",
              });
            }
            return null;
          }}
        </form.form.Subscribe>

        <form.form.Subscribe
          selector={(state) => [
            state.canSubmit,
            state.isSubmitting,
            state.isPristine,
          ]}
        >
          {([canSubmit, isSubmitting, isPristine]) => (
            <Button
              colorScheme="blue"
              disabled={!canSubmit || isPristine || !video.videoFile}
              loading={isSubmitting}
              style={{ width: "100%" }}
              type="submit"
            >
              {isSubmitting ? "Uploading..." : "Upload"}
            </Button>
          )}
        </form.form.Subscribe>

        <form.form.Subscribe selector={(state) => state.errors}>
          {(errors) =>
            errors.length > 0 ? (
              <Text color="red.500" fontSize="sm" mt={2}>
                {errors.join(", ")}
              </Text>
            ) : null
          }
        </form.form.Subscribe>
      </form>
    </Box>
  );
}
