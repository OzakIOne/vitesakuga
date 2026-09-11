import { createFileRoute, redirect } from "@tanstack/react-router";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/upload")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        search: { redirect: location.pathname },
        to: "/login",
      });
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
