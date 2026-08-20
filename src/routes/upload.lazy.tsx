import {
  Portal,
  createListCollection,
  type ComboboxInputValueChangeDetails,
  type ComboboxValueChangeDetails,
} from "@ark-ui/react";
import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { LuCamera, LuUpload } from "react-icons/lu";
import { FieldInfo } from "src/components/form/FieldInfo";
import { FormTextWrapper } from "src/components/form/FieldText";
import { Button } from "src/components/ui/button";
import { Spinner } from "src/components/ui/feedback";
import { Field } from "src/components/ui/field";
import { Box, Grid } from "src/components/ui/layout";
import { Image } from "src/components/ui/media";
import { Combobox, FileUpload } from "src/components/ui/overlay";
import { TagInput } from "src/components/ui/tag-input";
import { toaster } from "src/components/ui/toaster";
import { Text } from "src/components/ui/typography";
import { Video, type VideoRef } from "src/components/Video";
import { postQueryDetail, postsKeys } from "src/lib/posts/posts.queries";
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
  const video = useVideoProcessing();
  const draft = useUploadDraft();

  const form = useUploadForm({
    draft: draft.draft,
    onDraftClear: draft.clear,
    thumbnail: video.thumbnails[video.selectedThumbnailIndex]?.file,
    videoFile: video.videoFile,
    videoMetadata: video.videoMetadata,
  });

  const videoRef = useRef<VideoRef>(null);

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
  const [selectedPost, setSelectedPost] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const isNumericSearch = /^\d+$/.test(relatedPostSearch.trim());
  const numericId = isNumericSearch ? Number(relatedPostSearch.trim()) : null;

  const { data: relatedPosts, isFetching: isSearchLoading } = useQuery({
    enabled: relatedPostSearch.length > 2 && !isNumericSearch,
    queryFn: async () =>
      searchPosts({
        data: { page: 0, q: relatedPostSearch, tags: [] },
      }),
    queryKey: postsKeys.search({
      dateRange: "all",
      page: 0,
      q: relatedPostSearch,
      sortBy: "newest",
      tags: [],
    }),
  });

  const { data: postById, isFetching: isIdLookupLoading } = useQuery({
    enabled: isNumericSearch && numericId !== null && numericId > 0,
    ...postQueryDetail(numericId ?? -1),
  });

  const isFetching = isSearchLoading || isIdLookupLoading;

  const relatedPostCollection = useMemo(() => {
    const items = new Map<string, { label: string; value: string }>();
    for (const post of relatedPosts?.data ?? []) {
      items.set(String(post.id), { label: post.title, value: String(post.id) });
    }
    if (postById) {
      const { id, title } = postById.post;
      items.set(String(id), { label: `${title} (#${id})`, value: String(id) });
    }
    return createListCollection({
      itemToString: (item) => item.label,
      itemToValue: (item) => item.value,
      items: [...items.values()],
    });
  }, [postById, relatedPosts]);

  const handleRelatedPostInputValueChange = (
    details: ComboboxInputValueChangeDetails,
  ) => {
    if (details.reason === "clear-trigger") {
      setRelatedPostSearch("");
      setSelectedPost(null);
      form.form.setFieldValue("relatedPostId", undefined);
      return;
    }
    // Ignore programmatic input updates: they carry a stale value and would
    // overwrite the input right after a suggestion is picked. Selections are
    // handled in `handleRelatedPostValueChange`.
    if (details.reason !== "input-change") {
      return;
    }
    setRelatedPostSearch(details.inputValue);
    setSelectedPost(null);
    if (details.inputValue.length === 0) {
      form.form.setFieldValue("relatedPostId", undefined);
    }
  };

  const handleRelatedPostValueChange = (
    details: ComboboxValueChangeDetails,
  ) => {
    const item =
      details.items[0] !== undefined
        ? details.items[0]
        : details.value[0]
          ? relatedPostCollection.find(details.value[0])
          : undefined;
    if (!item) {
      return;
    }
    form.form.setFieldValue("relatedPostId", Number(item.value));
    setSelectedPost({ id: Number(item.value), title: item.label });
    setRelatedPostSearch(item.label);
  };

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
                <Field.HelperText>
                  Search by title or enter a post ID
                </Field.HelperText>
                <Combobox.Root
                  closeOnSelect
                  collection={relatedPostCollection}
                  inputValue={relatedPostSearch}
                  onInputValueChange={handleRelatedPostInputValueChange}
                  onValueChange={handleRelatedPostValueChange}
                  selectionBehavior="replace"
                  value={selectedPost ? [String(selectedPost.id)] : []}
                >
                  <Combobox.Control>
                    <Combobox.Input
                      onBlur={field.handleBlur}
                      placeholder="Search by title or enter post ID..."
                      value={relatedPostSearch}
                    />
                    <Combobox.IndicatorGroup>
                      {isFetching && <Spinner size="sm" />}
                      {selectedPost && <Combobox.ClearTrigger />}
                      <Combobox.Trigger />
                    </Combobox.IndicatorGroup>
                  </Combobox.Control>
                  <Portal>
                    <Combobox.Positioner>
                      <Combobox.Content>
                        <Combobox.ItemGroup>
                          {relatedPostCollection.items.length > 0 ? (
                            relatedPostCollection.items.map((item) => (
                              <Combobox.Item item={item} key={item.value}>
                                <Combobox.ItemText>
                                  {item.label}
                                </Combobox.ItemText>
                              </Combobox.Item>
                            ))
                          ) : (
                            <Combobox.Empty>
                              {relatedPostSearch.length > 0 &&
                              relatedPostSearch.length < 3
                                ? "Type at least 3 characters to search"
                                : isFetching
                                  ? "Searching..."
                                  : "No posts found"}
                            </Combobox.Empty>
                          )}
                        </Combobox.ItemGroup>
                      </Combobox.Content>
                    </Combobox.Positioner>
                  </Portal>
                </Combobox.Root>
                {!isFetching &&
                  isNumericSearch &&
                  numericId !== null &&
                  numericId > 0 &&
                  !postById && (
                    <Text
                      className="dark:text-gray-400"
                      color="gray.500"
                      fontSize="sm"
                      mt={2}
                    >
                      No post found with ID #{numericId}
                    </Text>
                  )}
                {field.state.value && !selectedPost && (
                  <Box
                    bg="blue.50"
                    borderRadius="md"
                    className="dark:bg-blue-900/30"
                    mt={2}
                    p={2}
                  >
                    <Text fontSize="sm">
                      Selected Post ID: {field.state.value}
                    </Text>
                    <Button
                      mt={1}
                      onClick={() => {
                        field.handleChange(undefined);
                        setSelectedPost(null);
                        setRelatedPostSearch("");
                      }}
                      size="sm"
                    >
                      Clear
                    </Button>
                  </Box>
                )}
                {/* Kept for parity with the previous UI: the combobox input
                    shows the selected title; the hint below confirms the id. */}
                {field.state.value && selectedPost && (
                  <Text
                    className="dark:text-gray-400"
                    color="gray.500"
                    fontSize="sm"
                    mt={2}
                  >
                    Selected Post ID: {field.state.value}
                  </Text>
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
                          <LuUpload className="h-5 w-5 text-neutral-400" />
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
                videoName:
                  video.videoFile?.name ?? draft.draft?.videoName ?? "",
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
              loading={isSubmitting === true}
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
