import { Field, useForm } from "@tanstack/react-form";
import {
  createFileRoute,
  redirect,
  useRouteContext,
} from "@tanstack/react-router";
import z from "zod";
import { FieldInfo } from "~/components/FieldInfo";
import { postsUploadOptions } from "~/utils/posts";

export const Route = createFileRoute("/upload")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
});

const UploadSchema = z.object({
  title: z.string().min(3, "You must have a length of at least 3"),
  content: z.string().min(3, "You must have a length of at least 3"),
  userId: z.any(),
});

function RouteComponent() {
  const context = useRouteContext({ from: "/upload" });
  console.log(context.user);
  const form = useForm({
    defaultValues: {
      title: "",
      content: "",
      userId: context.user?.id,
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
      Hello "/upload"!
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.Field
          name="title"
          children={(field) => {
            return (
              <>
                <label htmlFor={field.name} className="floating-label">
                  <span>Post title</span>
                  <input
                    id={field.name}
                    name={field.name}
                    className="input"
                    value={field.state.value}
                    placeholder="One piece"
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </label>
                <FieldInfo field={field} />
              </>
            );
          }}
        />

        <form.Field
          name="content"
          children={(field) => {
            return (
              <>
                <label htmlFor={field.name} className="floating-label">
                  <span>Post content</span>
                  <input
                    id={field.name}
                    name={field.name}
                    className="input"
                    value={field.state.value}
                    placeholder="Amazing animation"
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </label>
                <FieldInfo field={field} />
              </>
            );
          }}
        />

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <button type="submit" className="btn" disabled={!canSubmit}>
              {isSubmitting ? "Uploading..." : "Upload"}
            </button>
          )}
        />
      </form>
    </div>
  );
}
