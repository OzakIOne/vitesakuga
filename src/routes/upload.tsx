import { createFileRoute, redirect } from "@tanstack/react-router";
import { hasPermission } from "src/lib/auth/capabilities";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/upload")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        search: { redirect: location.pathname },
        to: "/login",
      });
    }
    if (
      !hasPermission({
        capabilities: context.capabilities,
        permission: "posts:create",
      })
    ) {
      throw redirect({ to: "/" });
    }
    return { user: context.user };
  },
  head: () => ({
    meta: seo({
      description: "Upload and curate animation references on ViteSakuga.",
      noIndex: true,
      title: "Upload · ViteSakuga",
    }),
  }),
});
