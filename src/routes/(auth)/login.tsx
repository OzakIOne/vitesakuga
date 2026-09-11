import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { IoLogoGithub } from "react-icons/io";
import { PasskeySignInButton } from "src/components/PasskeySignInButton";
import { Button } from "src/components/ui/button";
import { EmailAutocomplete } from "src/components/ui/email-autocomplete";
import { Alert } from "src/components/ui/feedback";
import { Field } from "src/components/ui/field";
import { PasswordInput } from "src/components/ui/password-input";
import { Heading } from "src/components/ui/typography";
import { useLogin, useSocialLogin } from "src/lib/auth/auth.hooks";
import type { LoginInput } from "src/lib/auth/auth.hooks";
import { useTurnstile } from "src/lib/auth/useTurnstile";
import { envClient } from "src/lib/env/client";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/(auth)/login")({
  component: LoginForm,
  head: () => ({
    meta: seo({
      description: "Sign in to your ViteSakuga account.",
      title: "Sign in · ViteSakuga",
    }),
  }),
});

function LoginForm() {
  const { redirectUrl } = Route.useRouteContext();
  const loginMutation = useLogin(redirectUrl);
  const socialLogin = useSocialLogin(redirectUrl);
  const turnstileRequired =
    envClient.VITE_TURNSTILE_REQUIRED === "1" ||
    envClient.VITE_TURNSTILE_REQUIRED === "true";
  const { containerRef, execute: executeTurnstile } = useTurnstile(
    envClient.VITE_TURNSTILE_SITEKEY,
    turnstileRequired,
  );

  const [serverError, setServerError] = useState("");
  const [socialLoading, setSocialLoading] = useState(false);
  const [email, setEmail] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (serverError) errorRef.current?.focus();
  }, [serverError]);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // SAFETY: the form renders the required <input name="email"> (EmailAutocomplete);
    // FormData.get returns its string value, and the falsy check below guards empty input.
    const email = formData.get("email") as string;
    // SAFETY: the form renders the required <input name="password"> (PasswordInput);
    // FormData.get returns its string value, and the falsy check below guards empty input.
    const password = formData.get("password") as string;
    if (!(email && password)) {
      return;
    }
    const captchaToken = (await executeTurnstile()) ?? undefined;
    if (turnstileRequired && !captchaToken) {
      setServerError("Captcha verification failed, please try again.");
      return;
    }
    setServerError("");
    const args: LoginInput = { email, password };
    if (captchaToken) {
      args.captchaToken = captchaToken;
    }
    loginMutation.mutate(args, {
      onError: (error) => setServerError(error.message),
    });
  };

  const handleSocialLogin = async (provider: "github" | "google") => {
    setSocialLoading(true);
    setServerError("");
    try {
      await socialLogin(provider);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : String(error));
    } finally {
      setSocialLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] w-full flex-col items-center justify-center p-4">
      <form className="w-80 max-w-full" onSubmit={handleSubmit}>
        <Heading as="h1" className="mb-6" size="xl">
          Sign In
        </Heading>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-5">
            <Field.Root id="email" required>
              <Field.Label>
                Email <Field.RequiredIndicator />
              </Field.Label>
              <EmailAutocomplete
                autoComplete="email webauthn"
                id="email"
                name="email"
                onChange={setEmail}
                value={email}
              />
            </Field.Root>

            <Field.Root id="password" required>
              <Field.Label>
                Password <Field.RequiredIndicator />
              </Field.Label>
              <PasswordInput
                autoComplete="current-password"
                id="password"
                name="password"
              />
            </Field.Root>

            <Button loading={loginMutation.isPending} type="submit">
              {loginMutation.isPending ? "Logging in..." : "Login"}
            </Button>

            <PasskeySignInButton
              onError={setServerError}
              redirectUrl={redirectUrl}
            />

            {/* Invisible Turnstile widget mount point (no-op without sitekey). */}
            <div className="hidden" ref={containerRef} />
          </div>
          {serverError && (
            <Alert.Root ref={errorRef} status="error" tabIndex={-1}>
              <Alert.Content>
                <Alert.Indicator status="error" />
                <div>
                  <Alert.Title>Could Not Sign In</Alert.Title>
                  <Alert.Description>{serverError}</Alert.Description>
                </div>
              </Alert.Content>
            </Alert.Root>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Button
              disabled={socialLoading}
              onClick={() => void handleSocialLogin("github")}
              type="button"
            >
              <IoLogoGithub aria-hidden="true" />
              Login with GitHub
            </Button>
            {envClient.VITE_GOOGLE_CLIENT_ID && (
              <Button
                disabled={socialLoading}
                onClick={() => void handleSocialLogin("google")}
                type="button"
              >
                <FcGoogle aria-hidden="true" />
                Login with Google
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
