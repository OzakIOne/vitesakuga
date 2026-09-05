import { createFileRoute } from "@tanstack/react-router";
import { auth } from "src/lib/auth";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      // oxlint-disable-next-line effecttsgo/async-function -- TanStack Router server handlers require a Promise-returning signature; auth.handler(request) is Better Auth's Promise-based contract
      GET: async ({ request }) => auth.handler(request),
      // oxlint-disable-next-line effecttsgo/async-function -- see GET above
      POST: async ({ request }) => auth.handler(request),
    },
  },
});
