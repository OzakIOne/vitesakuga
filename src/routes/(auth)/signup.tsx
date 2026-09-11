import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { IoLogoGithub } from "react-icons/io";
import { FieldInfo } from "src/components/form/FieldInfo";
import { Button } from "src/components/ui/button";
import { EmailAutocomplete } from "src/components/ui/email-autocomplete";
import { Alert } from "src/components/ui/feedback";
import { Field, Input } from "src/components/ui/field";
import {
  PasswordInput,
  PasswordStrengthMeter,
  getPasswordStrength,
} from "src/components/ui/password-input";
import { Heading } from "src/components/ui/typography";
import {
  useResendEmailVerification,
  useSignUp,
  useSocialLogin,
  useVerifyEmail,
} from "src/lib/auth/auth.hooks";
import type { SignUpInput } from "src/lib/auth/auth.hooks";
import { signUpSchema } from "src/lib/auth/auth.schemas";
import { useTurnstile } from "src/lib/auth/useTurnstile";
import { toStandardSchemaV1Strict } from "src/lib/effect/schema.utils";
import { envClient } from "src/lib/env/client";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/(auth)/signup")({
  component: SignupForm,
  head: () => ({
    meta: seo({
      description:
        "Create a ViteSakuga account to upload and curate animation references.",
      title: "Create an account · ViteSakuga",
    }),
  }),
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
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (serverError) errorRef.current?.focus();
  }, [serverError]);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const verifyEmailMutation = useVerifyEmail(redirectUrl);
  const resendEmailVerification = useResendEmailVerification();

  const form = useForm({
    defaultValues: {
      confirm_password: "",
      email: "",
      name: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setServerError("");
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
        onSuccess: (data) => {
          if (!data?.user?.emailVerified) {
            setVerificationEmail(value.email);
            setVerificationCode("");
          }
        },
        onError: (error) => setServerError(error.message),
      });
    },
    validators: {
      onChange: toStandardSchemaV1Strict(signUpSchema),
    },
  });

  if (verificationEmail) {
    return (
      <div className="flex min-h-[calc(100dvh-8rem)] w-full flex-col items-center justify-center p-4">
        <div className="w-80 max-w-full">
          <div className="flex flex-col gap-5">
            <div>
              <Heading as="h1" size="lg">
                Check your email
              </Heading>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                We sent a six-digit verification code to {verificationEmail}.
                Enter it here to finish creating your account.
              </p>
            </div>

            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                setServerError("");
                verifyEmailMutation.mutate(
                  { email: verificationEmail, otp: verificationCode },
                  { onError: (error) => setServerError(error.message) },
                );
              }}
            >
              <Field.Root id="verification-code" required>
                <Field.Label>
                  Verification code <Field.RequiredIndicator />
                </Field.Label>
                <Input
                  autoComplete="one-time-code"
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={verificationCode}
                  onChange={(event) =>
                    setVerificationCode(
                      event.target.value.replace(/\D/gu, "").slice(0, 6),
                    )
                  }
                />
              </Field.Root>

              <Button
                disabled={
                  verificationCode.length !== 6 || verifyEmailMutation.isPending
                }
                type="submit"
              >
                {verifyEmailMutation.isPending
                  ? "Verifying..."
                  : "Verify email"}
              </Button>
            </form>

            {serverError && (
              <Alert.Root ref={errorRef} status="error" tabIndex={-1}>
                <Alert.Content>
                  <Alert.Indicator status="error" />
                  <div>
                    <Alert.Title>Could Not Verify Email</Alert.Title>
                    <Alert.Description>{serverError}</Alert.Description>
                  </div>
                </Alert.Content>
              </Alert.Root>
            )}

            <div className="flex flex-col gap-2">
              <Button
                disabled={resendEmailVerification.isPending}
                onClick={() => {
                  setServerError("");
                  resendEmailVerification.mutate(
                    { email: verificationEmail },
                    {
                      onError: (error) => setServerError(error.message),
                    },
                  );
                }}
                variant="outline"
                type="button"
              >
                {resendEmailVerification.isPending
                  ? "Sending..."
                  : "Resend code"}
              </Button>
              <Button
                onClick={() => {
                  setServerError("");
                  setVerificationEmail("");
                  setVerificationCode("");
                }}
                variant="ghost"
                type="button"
              >
                Use a different email
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] w-full flex-col items-center justify-center p-4">
      <form
        className="w-80 max-w-full"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <Heading as="h1" className="mb-6" size="xl">
          Create Account
        </Heading>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-5">
            <form.Field name="name">
              {(field) => (
                <>
                  <Field.Root
                    id={field.name}
                    invalid={!field.state.meta.isValid}
                    required
                  >
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
                      placeholder="Jane Doe"
                      value={field.state.value}
                    />
                    <FieldInfo field={field} />
                  </Field.Root>
                </>
              )}
            </form.Field>

            <form.Field name="email">
              {(field) => (
                <>
                  <Field.Root
                    id={field.name}
                    invalid={!field.state.meta.isValid}
                    required
                  >
                    <Field.Label>
                      Email <Field.RequiredIndicator />
                    </Field.Label>
                    <EmailAutocomplete
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(value) => field.handleChange(value)}
                      placeholder="hello@gmail.com"
                      value={field.state.value}
                    />
                    <FieldInfo field={field} />
                  </Field.Root>
                </>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => {
                const strength = getPasswordStrength(field.state.value);
                return (
                  <>
                    <Field.Root
                      id={field.name}
                      invalid={!field.state.meta.isValid}
                      required
                    >
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
                      <FieldInfo field={field} />
                    </Field.Root>
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
                  <Field.Root
                    id={field.name}
                    invalid={!field.state.meta.isValid}
                    required
                  >
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
                    <FieldInfo field={field} />
                  </Field.Root>
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
            <Alert.Root ref={errorRef} status="error" tabIndex={-1}>
              <Alert.Content>
                <Alert.Indicator status="error" />
                <div>
                  <Alert.Title>Could Not Create Account</Alert.Title>
                  <Alert.Description>{serverError}</Alert.Description>
                </div>
              </Alert.Content>
            </Alert.Root>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Button
              disabled={signUpMutation.isPending}
              onClick={() =>
                void socialLogin("github").catch((error) =>
                  setServerError(
                    error instanceof Error ? error.message : String(error),
                  ),
                )
              }
              type="button"
            >
              <IoLogoGithub aria-hidden="true" />
              Sign up with GitHub
            </Button>
            {envClient.VITE_GOOGLE_CLIENT_ID && (
              <Button
                disabled={signUpMutation.isPending}
                onClick={() =>
                  void socialLogin("google").catch((error) =>
                    setServerError(
                      error instanceof Error ? error.message : String(error),
                    ),
                  )
                }
                type="button"
              >
                <FcGoogle aria-hidden="true" />
                Sign up with Google
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
