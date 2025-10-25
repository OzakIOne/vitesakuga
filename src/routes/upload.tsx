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
import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  redirect,
  useBlocker,
  useRouteContext,
} from "@tanstack/react-router";
import { useState } from "react";
import { LuUpload } from "react-icons/lu";
import { FieldInfo } from "src/components/FieldInfo";
import { TagInput } from "src/components/ui/tag-input";
import { Video } from "src/components/Video";
import { postsUploadOptions, searchPosts } from "src/lib/posts/posts.fn";
import { z } from "zod";
import { TagSchema } from "./api/posts";

export const Route = createFileRoute("/upload")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
});

const UploadSchema = z.object({
  title: z.string().min(3, "You must have a length of at least 3"),
  content: z.string().min(3, "You must have a length of at least 3"),
  userId: z.string(),
  video: z.file(),
  source: z.url().or(z.literal("")).or(z.undefined()),
  relatedPostId: z.number().or(z.undefined()),
  tags: z.array(TagSchema),
});

export type UploadFormValues = {
  title: string;
  content: string;
  source: string | undefined;
  relatedPostId: number | undefined;
  tags: z.infer<typeof TagSchema>[];
  userId: string;
  video: File | undefined;
};

function RouteComponent() {
  const context = useRouteContext({ from: "/upload" });
  const [videoFilePreview, setVideoPreviewUrl] = useState<string | null>(null);

  useBlocker({
    shouldBlockFn: () => {
      if (!form.state.isDirty) return false;

      const shouldLeave = confirm(
        "You have unsubmitted changes. Do you want to leave?",
      );
      return !shouldLeave;
    },
  });

  const form = useForm({
    defaultValues: {
      title: "",
      content: "",
      source: undefined,
      relatedPostId: undefined,
      tags: [],
      userId: context.user!.id,
      video: undefined,
    } as UploadFormValues,
    validators: {
      onSubmit: UploadSchema,
    },
    onSubmit: async ({ value }) => {
      console.log("Submitting upload form with values:", value);
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
                  {videoFilePreview && <Video url={videoFilePreview} bypass />}
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
