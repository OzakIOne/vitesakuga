import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { IoLogoGithub } from "react-icons/io";
import { Button } from "src/components/ui/button";
import { EmailAutocomplete } from "src/components/ui/email-autocomplete";
import { Field } from "src/components/ui/field";
import { PasswordInput } from "src/components/ui/password-input";
import { useLogin, useSocialLogin } from "src/lib/auth/auth.hooks";

export const Route = createFileRoute("/(auth)/login")({
  component: LoginForm,
});

function LoginForm() {
  const { redirectUrl } = Route.useRouteContext();
  const loginMutation = useLogin(redirectUrl);
  const socialLogin = useSocialLogin(redirectUrl);

  const [serverError, setServerError] = useState("");
  const [socialLoading, setSocialLoading] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    if (!(email && password)) {
      return;
    }
    setServerError("");
    loginMutation.mutate(
      { email, password },
      {
        onError: (error) => setServerError(error.message),
      },
    );
  };

  const handleSocialLogin = async (provider: "github" | "google") => {
    setSocialLoading(true);
    setServerError("");
    try {
      await socialLogin(provider);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="with-full flex h-fit flex-col items-center justify-center p-4">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-5">
            <Field.Root required>
              <Field.Label>
                Email <Field.RequiredIndicator />
              </Field.Label>
              <EmailAutocomplete
                id="email"
                name="email"
                onChange={setEmail}
                value={email}
              />
            </Field.Root>

            <Field.Root required>
              <Field.Label>
                Password <Field.RequiredIndicator />
              </Field.Label>
              <PasswordInput
                autoComplete="current-password"
                id="password"
                name="password"
              />
            </Field.Root>

            <Button disabled={loginMutation.isPending} type="submit">
              {loginMutation.isPending ? "Logging in..." : "Login"}
            </Button>
          </div>
          {serverError && (
            <span className="text-destructive text-center text-sm">
              {serverError}
            </span>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Button
              disabled={socialLoading}
              onClick={() => void handleSocialLogin("github")}
              type="button"
            >
              <IoLogoGithub />
              Login with GitHub
            </Button>
            <Button
              disabled={socialLoading}
              onClick={() => void handleSocialLogin("google")}
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
