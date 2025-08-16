import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import authClient from "~/auth/client";
import { Box, Button, Field, FileUpload, Icon, Input } from "@chakra-ui/react";
import { PasswordInput } from "~/components/ui/password-input";
import { FcGoogle } from "react-icons/fc";
import { IoLogoGithub } from "react-icons/io";

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
    if (!email || !password) return;

    setIsLoading(true);
    setErrorMessage("");

    authClient.signIn.email(
      {
        email,
        password,
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
  };

  return (
    <div className="flex flex-col items-center justify-center with-full h-fit p-4">
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
              <PasswordInput type="password" name="password" id="password" />
            </Field.Root>

            <Button type="submit" className="btn" disabled={isLoading}>
              {isLoading && (
                <span className="loading loading-spinner loading-lg" />
              )}
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </div>
          {errorMessage && (
            <span className="text-destructive text-center text-sm">
              {errorMessage}
            </span>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Button
              className="btn bg-black text-white border-black"
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
              className="btn bg-white text-black border-[#e5e5e5]"
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
