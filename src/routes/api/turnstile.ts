import { createFileRoute } from "@tanstack/react-router";
import { envServer } from "src/lib/env/server";

export const Route = createFileRoute("/api/turnstile")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { sitekey: envServer.TURNSTILE_SITEKEY },
          {
            headers: {
              "cache-control": "public, max-age=3600",
            },
          },
        ),
    },
  },
});
