import { Button, Field, Input } from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { IoLogoGithub } from "react-icons/io";
import { FieldInfo } from "src/components/form/FieldInfo";
import { PasswordInput } from "src/components/ui/password-input";
import { useSignUp, useSocialLogin } from "src/lib/auth/auth.hooks";
import { signUpSchema } from "src/lib/auth/auth.schemas";

export const Route = createFileRoute("/(auth)/signup")({
  component: SignupForm,
});

function SignupForm() {
  const { redirectUrl } = Route.useRouteContext();
  const signUpMutation = useSignUp(redirectUrl);
  const socialLogin = useSocialLogin(redirectUrl);

  const [serverError, setServerError] = useState("");

  const form = useForm({
    defaultValues: {
      confirm_password: "",
      email: "",
      name: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      signUpMutation.mutate(value, {
        onError: (error) => setServerError(error.message),
      });
    },
    validators: {
      onChange: signUpSchema,
    },
  });

  return (
    <div className="with-full flex h-fit flex-col items-center justify-center p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-5">
            <form.Field name="name">
              {(field) => (
                <>
                  <Field.Root required>
                    <Field.Label>
                      Name <Field.RequiredIndicator />
                    </Field.Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                      }}
                      placeholder="John doe"
                      value={field.state.value}
                    />
                  </Field.Root>
                  <FieldInfo field={field} />
                </>
              )}
            </form.Field>

            <form.Field name="email">
              {(field) => (
                <>
                  <Field.Root required>
                    <Field.Label>
                      Email <Field.RequiredIndicator />
                    </Field.Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                      }}
                      placeholder="hello@example.com"
                      value={field.state.value}
                    />
                  </Field.Root>
                  <FieldInfo field={field} />
                </>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <>
                  <Field.Root required>
                    <Field.Label>
                      Password <Field.RequiredIndicator />
                    </Field.Label>
                    <PasswordInput
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                      }}
                      type="password"
                      value={field.state.value}
                    />
                  </Field.Root>
                  <FieldInfo field={field} />
                </>
              )}
            </form.Field>

            <form.Field
              name="confirm_password"
              validators={{
                onChangeListenTo: ["password"],
              }}
            >
              {(field) => (
                <>
                  <Field.Root required>
                    <Field.Label>
                      Confirm password <Field.RequiredIndicator />
                    </Field.Label>
                    <PasswordInput
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                      }}
                      type="password"
                      value={field.state.value}
                    />
                  </Field.Root>
                  <FieldInfo field={field} />
                </>
              )}
            </form.Field>

            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <Button disabled={!canSubmit} type="submit">
                  {isSubmitting ? "Signing up..." : "Sign up"}
                </Button>
              )}
            </form.Subscribe>
          </div>
          {serverError && (
            <div className="alert alert-error" role="alert">
              <span>{serverError}</span>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Button
              disabled={signUpMutation.isPending}
              onClick={() => void socialLogin("github").catch(setServerError)}
              type="button"
            >
              <IoLogoGithub />
              Login with GitHub
            </Button>
            <Button
              disabled={signUpMutation.isPending}
              onClick={() => void socialLogin("google").catch(setServerError)}
              type="button"
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
