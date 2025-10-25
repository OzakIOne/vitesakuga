import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import authClient from "src/lib/auth/client";
import { z } from "zod";
import { FieldInfo } from "src/components/FieldInfo";
import { Button, Field, Input } from "@chakra-ui/react";
import { PasswordInput } from "src/components/ui/password-input";
import { FcGoogle } from "react-icons/fc";
import { IoLogoGithub } from "react-icons/io";

export const Route = createFileRoute("/(auth)/signup")({
  component: SignupForm,
});

const SignUpSchema = z
  .object({
    name: z.string().min(3, "You must have a length of at least 3"),
    email: z.email(),
    password: z.string().min(8, "You must have a length of at least 8"),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

function SignupForm() {
  const { redirectUrl } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirm_password: "",
    },
    validators: {
      onChange: SignUpSchema,
    },
    onSubmit: ({ value }) => {
      authClient.signUp.email(
        {
          name: value.name,
          email: value.email,
          password: value.password,
          callbackURL: redirectUrl,
        },
        {
          onError: (ctx) => {
            setErrorMessage(ctx.error.message);
            setIsLoading(false);
          },
          onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["user"] });
            navigate({ to: redirectUrl });
          },
        }
      );
    },
  });

  return (
    <div className="flex flex-col items-center justify-center with-full h-fit p-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await form.handleSubmit();
        }}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-5">
            <form.Field name="name">
              {(field) => {
                // Avoid hasty abstractions. Render props are great!
                return (
                  <>
                    <Field.Root required>
                      <Field.Label>
                        Name <Field.RequiredIndicator />
                      </Field.Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        placeholder="John doe"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                      />
                    </Field.Root>
                    <FieldInfo field={field} />
                  </>
                );
              }}
            </form.Field>

            <form.Field name="email">
              {(field) => {
                // Avoid hasty abstractions. Render props are great!
                return (
                  <>
                    <Field.Root required>
                      <Field.Label>
                        Email <Field.RequiredIndicator />
                      </Field.Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        placeholder="hello@example.com"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                      />
                    </Field.Root>

                    <FieldInfo field={field} />
                  </>
                );
              }}
            </form.Field>

            <form.Field name="password">
              {(field) => {
                // Avoid hasty abstractions. Render props are great!
                return (
                  <>
                    <Field.Root required>
                      <Field.Label>
                        Password <Field.RequiredIndicator />
                      </Field.Label>
                      <PasswordInput
                        type="password"
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                      />
                    </Field.Root>
                    <FieldInfo field={field} />
                  </>
                );
              }}
            </form.Field>

            <form.Field
              name="confirm_password"
              validators={{
                onChangeListenTo: ["password"], // Ensure this field listens to changes in the password field
              }}
            >
              {(field) => {
                // Avoid hasty abstractions. Render props are great!
                return (
                  <>
                    <Field.Root required>
                      <Field.Label>
                        Confirm password <Field.RequiredIndicator />
                      </Field.Label>
                      <PasswordInput
                        type="password"
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                      />
                    </Field.Root>
                    <FieldInfo field={field} />
                    <FieldInfo field={field} />
                  </>
                );
              }}
            </form.Field>

            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <Button type="submit" className="btn" disabled={!canSubmit}>
                  {isSubmitting ? "Signing up..." : "Sign up"}
                </Button>
              )}
            </form.Subscribe>
          </div>
          {errorMessage && (
            <div role="alert" className="alert alert-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 shrink-0 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Button
              type="button"
              disabled={isLoading}
              onClick={() =>
                authClient.signIn.social(
                  {
                    provider: "github",
                    callbackURL: redirectUrl,
                  },
                  {
                    onRequest: () => {
                      setIsLoading(true);
                      setErrorMessage("");
                    },
                    onError: (ctx) => {
                      setIsLoading(false);
                      setErrorMessage(ctx.error.message);
                    },
                  }
                )
              }
            >
              <IoLogoGithub />
              Login with GitHub
            </Button>
            <Button
              type="button"
              disabled={isLoading}
              onClick={() =>
                authClient.signIn.social(
                  {
                    provider: "google",
                    callbackURL: redirectUrl,
                  },
                  {
                    onRequest: () => {
                      setIsLoading(true);
                      setErrorMessage("");
                    },
                    onError: (ctx) => {
                      setIsLoading(false);
                      setErrorMessage(ctx.error.message);
                    },
                  }
                )
              }
            >
              <FcGoogle />
              Login with Google
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
