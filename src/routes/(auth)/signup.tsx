import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { IoLogoGithub } from "react-icons/io";
import { FieldInfo } from "src/components/form/FieldInfo";
import { Button } from "src/components/ui/button";
import { EmailAutocomplete } from "src/components/ui/email-autocomplete";
import { Field, Input } from "src/components/ui/field";
import {
  PasswordInput,
  PasswordStrengthMeter,
  getPasswordStrength,
} from "src/components/ui/password-input";
import { useSignUp, useSocialLogin } from "src/lib/auth/auth.hooks";
import type { SignUpInput } from "src/lib/auth/auth.hooks";
import { signUpSchema } from "src/lib/auth/auth.schemas";
import { useTurnstile } from "src/lib/auth/useTurnstile";
import { toStandardSchemaV1Strict } from "src/lib/effect/schema.utils";
import { envClient } from "src/lib/env/client";

export const Route = createFileRoute("/(auth)/signup")({
  component: SignupForm,
});

function SignupForm() {
  const { redirectUrl } = Route.useRouteContext();
  const signUpMutation = useSignUp(redirectUrl);
  const socialLogin = useSocialLogin(redirectUrl);
  const turnstileRequired =
    envClient.VITE_TURNSTILE_REQUIRED === "1" ||
    envClient.VITE_TURNSTILE_REQUIRED === "true";
  const { containerRef, execute: executeTurnstile } = useTurnstile(
    envClient.VITE_TURNSTILE_SITEKEY,
    turnstileRequired,
  );

  const [serverError, setServerError] = useState("");

  const form = useForm({
    defaultValues: {
      confirm_password: "",
      email: "",
      name: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      const captchaToken = (await executeTurnstile()) ?? undefined;
      if (turnstileRequired && !captchaToken) {
        setServerError("Captcha verification failed, please try again.");
        return;
      }
      const args: SignUpInput = {
        name: value.name,
        email: value.email,
        password: value.password,
      };
      if (captchaToken) {
        args.captchaToken = captchaToken;
      }
      signUpMutation.mutate(args, {
        onError: (error) => setServerError(error.message),
      });
    },
    validators: {
      onChange: toStandardSchemaV1Strict(signUpSchema),
    },
  });

  return (
    <div className="with-full flex h-fit flex-col items-center justify-center p-4">
      <form
        className="w-80 max-w-full"
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
                  <Field.Root id={field.name} required>
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
                  <Field.Root id={field.name} required>
                    <Field.Label>
                      Email <Field.RequiredIndicator />
                    </Field.Label>
                    <EmailAutocomplete
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(value) => field.handleChange(value)}
                      placeholder="hello@example.com"
                      value={field.state.value}
                    />
                  </Field.Root>
                  <FieldInfo field={field} />
                </>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => {
                const strength = getPasswordStrength(field.state.value);
                return (
                  <>
                    <Field.Root id={field.name} required>
                      <Field.Label>
                        Password <Field.RequiredIndicator />
                      </Field.Label>
                      <PasswordInput
                        autoComplete="new-password"
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                        value={field.state.value}
                      />
                      {field.state.value.length > 0 && (
                        <PasswordStrengthMeter
                          label={
                            strength.level.charAt(0).toUpperCase() +
                            strength.level.slice(1)
                          }
                          value={strength.score}
                        />
                      )}
                    </Field.Root>
                    <FieldInfo field={field} />
                  </>
                );
              }}
            </form.Field>

            <form.Field
              name="confirm_password"
              validators={{
                onChangeListenTo: ["password"],
                onChange: ({ value, fieldApi }) => {
                  if (value !== fieldApi.form.state.values.password) {
                    return "Passwords do not match";
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <>
                  <Field.Root id={field.name} required>
                    <Field.Label>
                      Confirm password <Field.RequiredIndicator />
                    </Field.Label>
                    <PasswordInput
                      autoComplete="new-password"
                      id={field.name}
                      invalid={
                        field.state.meta.isTouched && !field.state.meta.isValid
                      }
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                      }}
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

            {/* Invisible Turnstile widget mount point (no-op without sitekey). */}
            <div className="hidden" ref={containerRef} />
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
            {envClient.VITE_GOOGLE_CLIENT_ID && (
              <Button
                disabled={signUpMutation.isPending}
                onClick={() => void socialLogin("google").catch(setServerError)}
                type="button"
              >
                <FcGoogle />
                Login with Google
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
