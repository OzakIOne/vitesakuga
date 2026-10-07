import { createFileRoute } from "@tanstack/react-router";
import { auth } from "src/lib/auth";
import { redirectTwoFactorOAuthCallback } from "src/lib/auth/two-factor-callback-response";

const handleAuthRequest = async (request: Request) =>
  redirectTwoFactorOAuthCallback({
    request,
    response: await auth.handler(request),
  });

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthRequest(request),
      POST: ({ request }) => handleAuthRequest(request),
    },
  },
});
