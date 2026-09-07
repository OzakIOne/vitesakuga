import {
  Portal,
  createListCollection,
  type ComboboxInputValueChangeDetails,
  type ComboboxValueChangeDetails,
} from "@ark-ui/react";
import type { AnyFieldApi } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuCamera,
  LuChevronDown,
  LuChevronUp,
  LuImage,
  LuTrash2,
  LuUpload,
} from "react-icons/lu";
import { FieldInfo } from "src/components/form/FieldInfo";
import { FormTextWrapper } from "src/components/form/FieldText";
import { Button } from "src/components/ui/button";
import { Spinner } from "src/components/ui/feedback";
import { Field } from "src/components/ui/field";
import { Box, Grid, HStack } from "src/components/ui/layout";
import { Image } from "src/components/ui/media";
import { NumberInput } from "src/components/ui/number-input";
import { Combobox, FileUpload } from "src/components/ui/overlay";
import { TagInput } from "src/components/ui/tag-input";
import { toaster } from "src/components/ui/toaster";
import { Text } from "src/components/ui/typography";
import { Video, type VideoRef } from "src/components/Video";
import { VideoMetadataDialog } from "src/components/VideoMetadataDialog";
import { postQueryDetail, postsKeys } from "src/lib/posts/posts.queries";
import {
  getImageFileValidationError,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGES_PER_POST,
  MIN_TEXT_LENGTH,
} from "src/lib/posts/posts.schema";
import { searchPosts } from "src/lib/posts/posts.service";
import { useUploadDraft } from "src/lib/upload/useUploadDraft";
import {
  useUploadForm,
  type UploadMediaKind,
} from "src/lib/upload/useUploadForm";
import { useVideoProcessing } from "src/lib/upload/useVideoProcessing";

export const Route = createLazyFileRoute("/upload")({
  component: RouteComponent,
  pendingComponent: () => (
    <Box maxW="xl" mx="auto" px={4} py={8}>
      <Text>Loading upload form...</Text>
    </Box>
  ),
});

type MetaNumberFieldProps = {
  field: AnyFieldApi;
  label: string;
  inputLabel: string;
};

// Shared NumberInput for the optional numeric metadata pairs: videos use
// season/episode, image posts use volume/chapter. An empty input clears the
// value back to undefined so the key is stripped before schema validation.
function MetaNumberField({ field, label, inputLabel }: MetaNumberFieldProps) {
  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <NumberInput.Root
        allowMouseWheel
        min={1}
        onBlur={field.handleBlur}
        onValueChange={(details) => {
          const parsed = details.valueAsNumber;
          field.handleChange(
            details.value === "" || Number.isNaN(parsed) ? undefined : parsed,
          );
        }}
        step={1}
        value={field.state.value?.toString() ?? ""}
      >
        <NumberInput.Control>
          <NumberInput.Input aria-label={inputLabel} />
          <NumberInput.DecrementTrigger aria-label={`Decrease ${inputLabel}`} />
          <NumberInput.IncrementTrigger aria-label={`Increase ${inputLabel}`} />
        </NumberInput.Control>
      </NumberInput.Root>
      <FieldInfo field={field} />
    </Field.Root>
  );
}

function RouteComponent() {
  const [mediaKind, setMediaKind] = useState<UploadMediaKind>("video");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageValidationErrors, setImageValidationErrors] = useState<
    Record<string, string>
  >({});
  const [imagePreviewUrls, setImagePreviewUrls] = useState<
    Record<string, string>
  >({});
  const imagePreviewUrlsRef = useRef(imagePreviewUrls);
  useEffect(() => {
    imagePreviewUrlsRef.current = imagePreviewUrls;
  }, [imagePreviewUrls]);

  // Object URLs are revoked when the component unmounts. Individual URLs are
  // revoked by syncImagePreviews/removeImage when files leave the selection.
  useEffect(() => {
    return () => {
      for (const url of Object.values(imagePreviewUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const video = useVideoProcessing();
  const draft = useUploadDraft();

  const form = useUploadForm({
    draft: draft.draft,
    imageFiles,
    mediaKind,
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

  const imageFileKey = (file: File): string =>
    `${file.name}:${file.size}:${file.lastModified}`;

  const syncImagePreviews = (files: File[]) => {
    setImageFiles(files);
    setImagePreviewUrls((current) => {
      const next: Record<string, string> = {};
      const activeKeys = new Set<string>();
      for (const file of files) {
        const key = imageFileKey(file);
        activeKeys.add(key);
        next[key] = current[key] ?? URL.createObjectURL(file);
      }
      for (const [key, url] of Object.entries(current)) {
        if (!activeKeys.has(key)) {
          URL.revokeObjectURL(url);
        }
      }
      return next;
    });
  };

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= imageFiles.length) {
      return;
    }
    setImageFiles((current) => {
      const next = [...current];
      const [file] = next.splice(from, 1);
      if (file) {
        next.splice(to, 0, file);
      }
      return next;
    });
  };

  const removeImage = (index: number) => {
    const file = imageFiles[index];
    if (!file) {
      return;
    }
    setImageFiles((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
    setImageValidationErrors((current) => {
      const next = { ...current };
      delete next[imageFileKey(file)];
      return next;
    });
    setImagePreviewUrls((current) => {
      const key = imageFileKey(file);
      const url = current[key];
      if (url) {
        URL.revokeObjectURL(url);
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const formatImageRejection = (
    file: File,
    errors: readonly string[],
  ): string => {
    const validationError = getImageFileValidationError(file);
    if (validationError) {
      return validationError;
    }
    if (errors.includes("TOO_MANY_FILES")) {
      return `You can select up to ${MAX_IMAGES_PER_POST} images per post`;
    }
    return "This image could not be selected";
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
    // A wrong post ID is a definitive 404, not a transient failure: retrying
    // just delays the "no post found" feedback by three failed attempts.
    retry: false,
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
          <form.form.Field
            name="title"
            validators={{
              onBlur: ({ value }) =>
                value.trim().length < MIN_TEXT_LENGTH
                  ? `Title must be at least ${MIN_TEXT_LENGTH} characters`
                  : undefined,
            }}
          >
            {(field) => (
              <FormTextWrapper field={field} isRequired label="Title" />
            )}
          </form.form.Field>
        </Box>

        <Box mb={6}>
          <form.form.Field
            name="description"
            validators={{
              onBlur: ({ value }) =>
                value.trim().length < MIN_TEXT_LENGTH
                  ? `Description must be at least ${MIN_TEXT_LENGTH} characters`
                  : undefined,
            }}
          >
            {(field) => (
              <FormTextWrapper
                asTextarea
                field={field}
                helper={`A brief description of the animation (${MIN_TEXT_LENGTH} characters minimum)`}
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
                inputProps={{ type: "url" }}
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
          {/* Videos identify anime source material (season/episode); image
              posts identify manga source material (volume/chapter). */}
          {/* Literal class needed: Tailwind can't see dynamic grid-cols values. */}
          <Grid className="grid-cols-2" gap={4}>
            {mediaKind === "image" ? (
              <>
                <form.form.Field name="volumeNumber">
                  {(field) => (
                    <MetaNumberField
                      field={field}
                      inputLabel="Volume number"
                      label="Volume"
                    />
                  )}
                </form.form.Field>
                <form.form.Field name="chapterNumber">
                  {(field) => (
                    <MetaNumberField
                      field={field}
                      inputLabel="Chapter number"
                      label="Chapter"
                    />
                  )}
                </form.form.Field>
              </>
            ) : (
              <>
                <form.form.Field name="seasonNumber">
                  {(field) => (
                    <MetaNumberField
                      field={field}
                      inputLabel="Season number"
                      label="Season"
                    />
                  )}
                </form.form.Field>
                <form.form.Field name="episodeNumber">
                  {(field) => (
                    <MetaNumberField
                      field={field}
                      inputLabel="Episode number"
                      label="Episode"
                    />
                  )}
                </form.form.Field>
              </>
            )}
          </Grid>
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
          <Field.Root>
            <Field.Label>Post type</Field.Label>
            <HStack gap={2}>
              <Button
                colorPalette="blue"
                onClick={() => {
                  setMediaKind("video");
                }}
                size="sm"
                variant={mediaKind === "video" ? "solid" : "outline"}
              >
                Video
              </Button>
              <Button
                colorPalette="blue"
                onClick={() => {
                  setMediaKind("image");
                }}
                size="sm"
                variant={mediaKind === "image" ? "solid" : "outline"}
              >
                Image
              </Button>
            </HStack>
          </Field.Root>
        </Box>

        {mediaKind === "video" ? (
          <Box mb={6}>
            <form.form.Field name="videoKey">
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
                            <HStack gap={2}>
                              <VideoMetadataDialog
                                metadata={video.videoMetadata}
                              />
                              <Button
                                onClick={handleCapture}
                                size="sm"
                                variant="outline"
                              >
                                <LuCamera style={{ marginRight: "8px" }} />
                                Capture Current Frame
                              </Button>
                            </HStack>
                          </Box>
                          {video.thumbnails.length > 0 && (
                            <Grid className="grid-cols-5" gap={2}>
                              {video.thumbnails.map((thumb, index) => {
                                const isSelected =
                                  video.selectedThumbnailIndex === index;
                                return (
                                  <button
                                    aria-pressed={isSelected}
                                    className={
                                      isSelected
                                        ? "block cursor-pointer overflow-hidden rounded-md border-4 border-blue-500 p-0 transition-colors duration-200"
                                        : "block cursor-pointer overflow-hidden rounded-md border-4 border-transparent p-0 transition-colors duration-200 hover:border-gray-300 dark:hover:border-gray-600"
                                    }
                                    key={thumb.url}
                                    onClick={() => {
                                      video.selectThumbnail(index);
                                    }}
                                    type="button"
                                  >
                                    <Image
                                      alt={`Thumbnail ${index + 1}`}
                                      className="block w-full"
                                      src={thumb.url}
                                    />
                                  </button>
                                );
                              })}
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
        ) : (
          <Box mb={6}>
            <form.form.Field name="images">
              {(field) => (
                <Field.Root required>
                  <Field.Label>
                    Images <Field.RequiredIndicator />
                  </Field.Label>
                  <Field.HelperText>
                    Select up to {MAX_IMAGES_PER_POST} images. The first image
                    is the default post thumbnail.
                  </Field.HelperText>
                  <Text color="red.600" fontSize="sm" mt={1}>
                    Please do not abuse multi-image uploads. Abuse will be
                    sanctioned.
                  </Text>
                  <FileUpload.Root
                    accept={["image/*"]}
                    alignItems="stretch"
                    acceptedFiles={imageFiles}
                    maxFileSize={MAX_IMAGE_SIZE_BYTES}
                    maxFiles={MAX_IMAGES_PER_POST}
                    maxW="xl"
                    onFileChange={(details) => {
                      syncImagePreviews(details.acceptedFiles);
                      field.handleChange(
                        details.acceptedFiles.length > 0
                          ? details.acceptedFiles
                          : undefined,
                      );
                      setImageValidationErrors((current) => {
                        const next = { ...current };
                        for (const file of details.acceptedFiles) {
                          delete next[imageFileKey(file)];
                        }
                        for (const rejection of details.rejectedFiles) {
                          next[imageFileKey(rejection.file)] =
                            formatImageRejection(
                              rejection.file,
                              rejection.errors,
                            );
                        }
                        return next;
                      });
                    }}
                    validate={(file) =>
                      getImageFileValidationError(file)
                        ? ["INVALID_IMAGE"]
                        : null
                    }
                  >
                    <FileUpload.HiddenInput />
                    {imageFiles.length < MAX_IMAGES_PER_POST && (
                      <FileUpload.Dropzone minHeight="32">
                        <LuImage className="h-5 w-5 text-neutral-400" />
                        <FileUpload.DropzoneContent>
                          <Box>Drag and drop images here</Box>
                          <Box color="fg.muted">
                            {".jpg, .png, .webp (10 MB each, " +
                              MAX_IMAGES_PER_POST +
                              " max)"}
                          </Box>
                        </FileUpload.DropzoneContent>
                      </FileUpload.Dropzone>
                    )}
                  </FileUpload.Root>
                  {imageFiles.length > 0 && (
                    <Grid className="grid-cols-2 md:grid-cols-3" gap={3} mt={3}>
                      {imageFiles.map((file, index) => {
                        const isDefaultThumbnail = index === 0;
                        const previewUrl = imagePreviewUrls[imageFileKey(file)];
                        return (
                          <Box
                            border="1px"
                            borderColor={
                              isDefaultThumbnail ? "blue.500" : "gray.200"
                            }
                            borderRadius="md"
                            key={imageFileKey(file)}
                            overflow="hidden"
                            p={2}
                          >
                            {previewUrl && (
                              <Image
                                alt={"Preview of " + file.name}
                                className="aspect-square w-full object-contain"
                                src={previewUrl}
                              />
                            )}
                            <Text
                              className="truncate"
                              fontSize="sm"
                              mt={2}
                              title={file.name}
                            >
                              {file.name}
                            </Text>
                            <Text
                              color={
                                isDefaultThumbnail ? "blue.600" : "gray.500"
                              }
                              fontSize="xs"
                              mt={1}
                            >
                              {isDefaultThumbnail
                                ? "Default thumbnail"
                                : "Image " + (index + 1)}
                            </Text>
                            <HStack gap={1} mt={2}>
                              <Button
                                aria-label={"Move " + file.name + " earlier"}
                                disabled={index === 0}
                                onClick={() => moveImage(index, index - 1)}
                                size="xs"
                                variant="outline"
                              >
                                <LuChevronUp />
                              </Button>
                              <Button
                                aria-label={"Move " + file.name + " later"}
                                disabled={index === imageFiles.length - 1}
                                onClick={() => moveImage(index, index + 1)}
                                size="xs"
                                variant="outline"
                              >
                                <LuChevronDown />
                              </Button>
                              <Button
                                aria-label={"Remove " + file.name}
                                colorPalette="red"
                                onClick={() => removeImage(index)}
                                size="xs"
                                variant="ghost"
                              >
                                <LuTrash2 />
                              </Button>
                            </HStack>
                          </Box>
                        );
                      })}
                    </Grid>
                  )}
                  {Object.entries(imageValidationErrors).length > 0 && (
                    <Box
                      aria-live="polite"
                      bg="red.50"
                      borderRadius="md"
                      className="dark:bg-red-950/30"
                      mt={3}
                      p={3}
                    >
                      <Text color="red.700" fontSize="sm" fontWeight="medium">
                        Some images were not added:
                      </Text>
                      <ul className="mt-1 list-disc pl-5 text-sm text-red-700">
                        {Object.entries(imageValidationErrors).map(
                          ([fileKey, message]) => (
                            <li key={fileKey}>{message}</li>
                          ),
                        )}
                      </ul>
                    </Box>
                  )}
                  <FieldInfo field={field} />
                </Field.Root>
              )}
            </form.form.Field>
          </Box>
        )}

        <form.form.Subscribe selector={(state) => state.values}>
          {(values) => {
            if (values.title || values.description) {
              draft.persist({
                chapterNumber: values.chapterNumber,
                description: values.description ?? "",
                episodeNumber: values.episodeNumber,
                relatedPostId: values.relatedPostId,
                seasonNumber: values.seasonNumber,
                source: values.source,
                tags: values.tags ?? [],
                title: values.title ?? "",
                videoName:
                  video.videoFile?.name ?? draft.draft?.videoName ?? "",
                volumeNumber: values.volumeNumber,
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
          {([canSubmit, isFormSubmitting, isPristine]) => (
            <Button
              colorScheme="blue"
              disabled={
                !canSubmit ||
                isPristine ||
                // The presign + direct-to-R2 PUT run before form submission,
                // so the hook's pending state must disable the button too.
                form.isSubmitting === true ||
                (mediaKind === "video"
                  ? !video.videoFile
                  : imageFiles.length === 0)
              }
              loading={isFormSubmitting === true || form.isSubmitting === true}
              style={{ width: "100%" }}
              type="submit"
            >
              {isFormSubmitting || form.isSubmitting
                ? "Uploading..."
                : "Upload"}
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
