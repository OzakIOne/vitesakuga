import { Button, Field, Input } from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { IoLogoGithub } from "react-icons/io";
import { PasswordInput } from "src/components/ui/password-input";
import authClient from "src/lib/auth/client";
import { usersKeys } from "src/lib/users/users.queries";

export const Route = createFileRoute("/(auth)/login")({
  component: LoginForm,
});

function LoginForm() {
  const { redirectUrl } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    if (!(email && password)) return;

    setIsLoading(true);
    setErrorMessage("");

    authClient.signIn.email(
      {
        callbackURL: redirectUrl,
        email,
        password,
      },
      {
        onError: (ctx) => {
          setErrorMessage(ctx.error.message);
          setIsLoading(false);
        },
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: usersKeys.user });
          navigate({ to: redirectUrl });
        },
      },
    );
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
              <Input id="email" name="email" placeholder="hello@example.com" />
            </Field.Root>

            <Field.Root required>
              <Field.Label>
                Password <Field.RequiredIndicator />
              </Field.Label>
              <PasswordInput id="password" name="password" type="password" />
            </Field.Root>

            <Button className="btn" disabled={isLoading} type="submit">
              {isLoading && <span className="loading loading-spinner loading-lg" />}
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </div>
          {errorMessage && (
            <span className="text-center text-destructive text-sm">{errorMessage}</span>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Button
              className="btn"
              disabled={isLoading}
              onClick={() =>
                authClient.signIn.social(
                  {
                    callbackURL: redirectUrl,
                    provider: "github",
                  },
                  {
                    onError: (ctx) => {
                      setIsLoading(false);
                      setErrorMessage(ctx.error.message);
                    },
                    onRequest: () => {
                      setIsLoading(true);
                      setErrorMessage("");
                    },
                  },
                )
              }
              type="button"
            >
              <IoLogoGithub />
              Login with GitHub
            </Button>
            <Button
              disabled={isLoading}
              onClick={() =>
                authClient.signIn.social(
                  {
                    callbackURL: redirectUrl,
                    provider: "google",
                  },
                  {
                    onError: (ctx) => {
                      setIsLoading(false);
                      setErrorMessage(ctx.error.message);
                    },
                    onRequest: () => {
                      setIsLoading(true);
                      setErrorMessage("");
                    },
                  },
                )
              }
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
