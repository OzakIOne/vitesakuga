import {
  Box,
  Button,
  Field,
  FileUpload,
  Icon,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";

import {
  createFileRoute,
  redirect,
  useBlocker,
  useRouteContext,
  Link,
} from "@tanstack/react-router";
import { Video } from "~/components/Video";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { FieldInfo } from "~/components/FieldInfo";
import { postsUploadOptions, searchPosts } from "~/utils/posts";
import { TagInput } from "~/components/ui/tag-input";
import { LuUpload } from "react-icons/lu";
type Tag = {
  id?: number;
  name: string;
};

export const Route = createFileRoute("/upload")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
});

const TagSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
});

const UploadSchema = z.object({
  title: z.string().min(3, "You must have a length of at least 3"),
  content: z.string().min(3, "You must have a length of at least 3"),
  userId: z.string(),
  video: z.file(),
  source: z.url().optional(),
  relatedPostId: z.number().optional(),
  tags: z.array(TagSchema),
});

function RouteComponent() {
  const context = useRouteContext({ from: "/upload" });
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  useBlocker({
    shouldBlockFn: () => {
      if (!form.state.isDirty) return false;

      const shouldLeave = confirm(
        "You have unsubmitted changes do you want to leave?"
      );
      return !shouldLeave;
    },
  });

  const form = useForm({
    defaultValues: {
      title: "",
      content: "",
      source: "",
      relatedPostId: "",
      tags: [],
      userId: context.user!.id,
    },
    validators: {
      onChange: UploadSchema,
    },
    onSubmit: async ({ value }) => {
      console.log("Uploading post...", value);
      await context.queryClient.ensureQueryData(postsUploadOptions(value));
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
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
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
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
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
                  >
                    {relatedPosts.data.map((post) => (
                      <Box
                        key={post.id}
                        p={2}
                        cursor="pointer"
                        _hover={{ bg: "gray.100" }}
                        onClick={() => {
                          field.handleChange(post.id);
                          setRelatedPostSearch("");
                        }}
                      >
                        {post.title}
                      </Box>
                    ))}
                  </Box>
                )}
                {field.state.value && (
                  <Box mt={2}>
                    <Text>Selected Post ID: {field.state.value}</Text>
                    <Button size="sm" onClick={() => field.handleChange("")}>
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
                  value={field.state.value || []}
                  onChange={(newTags) => field.handleChange(newTags)}
                />
                <Field.HelperText>
                  Add tags to help others find this video. Press Enter to add a
                  new tag.
                </Field.HelperText>
                <Box mt={2} display="flex" flexDirection="column" gap={2}>
                  {field.state.value.map((tag, index) => (
                    <Box
                      key={index}
                      display="inline-flex"
                      alignItems="center"
                      px={2}
                      py={1}
                      bg="gray.100"
                      borderRadius="md"
                    >
                      <Text fontSize="sm">{tag.name}</Text>
                      <button
                        type="button"
                        onClick={() => {
                          const newTags = [...field.state.value];
                          newTags.splice(index, 1);
                          field.handleChange(newTags);
                        }}
                        className="ml-2 text-gray-500 hover:text-gray-700"
                      >
                        ×
                      </button>
                    </Box>
                  ))}
                </Box>
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
                    id={field.name}
                    name={field.name}
                    typeof=""
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
                    <FileUpload.Dropzone>
                      <Icon size="md" color="fg.muted">
                        <LuUpload />
                      </Icon>
                      <FileUpload.DropzoneContent>
                        <Box>Drag and drop files here</Box>
                        <Box color="fg.muted">.mp4, .mov, .mkv</Box>
                      </FileUpload.DropzoneContent>
                    </FileUpload.Dropzone>
                    <FileUpload.List showSize clearable />
                  </FileUpload.Root>
                  {videoPreviewUrl && (
                    <video
                      src={videoPreviewUrl}
                      controls
                      className="mt-4 w-50 rounded"
                      style={{ maxHeight: 300 }}
                    />
                  )}
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
