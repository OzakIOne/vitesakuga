import { Box, Button, Field, FileUpload, Icon, Input } from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";
import {
  createFileRoute,
  redirect,
  useBlocker,
  useRouteContext,
} from "@tanstack/react-router";
import { useState } from "react";
import z from "zod";
import { FieldInfo } from "~/components/FieldInfo";
import { postsUploadOptions } from "~/utils/posts";
import { LuUpload } from "react-icons/lu";

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
      userId: context.user!.id,
    },
    validators: {
      onChange: UploadSchema,
    },
    onSubmit: async ({ value }) => {
      await context.queryClient.ensureQueryData(postsUploadOptions(value));
    },
  });

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.Field name="title">
          {(field) => {
            return (
              <>
                <Field.Root required>
                  <Field.Label>
                    Title <Field.RequiredIndicator />
                  </Field.Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    className="input"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field.Root>
                <FieldInfo field={field} />
              </>
            );
          }}
        </form.Field>

        <form.Field name="content">
          {(field) => {
            return (
              <>
                <Field.Root required>
                  <Field.Label>
                    Content <Field.RequiredIndicator />
                  </Field.Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    className="input"
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
            );
          }}
        </form.Field>

        <form.Field name="video">
          {(field) => {
            return (
              <>
                <FileUpload.Root
                  maxW="xl"
                  alignItems="stretch"
                  accept={["video/*,.mkv"]}
                  id={field.name}
                  name={field.name}
                  typeof=""
                  className="file-input"
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
                <FieldInfo field={field} />
                {videoPreviewUrl && (
                  <video
                    src={videoPreviewUrl}
                    controls
                    className="mt-4 w-50 rounded"
                    style={{ maxHeight: 300 }}
                  />
                )}
              </>
            );
          }}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" className="btn" disabled={!canSubmit}>
              {isSubmitting ? "Uploading..." : "Upload"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
