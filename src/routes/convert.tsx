import { createFileRoute } from "@tanstack/react-router";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/convert")({
  ssr: false,
  head: () => ({
    meta: seo({
      description: "Convert animation video files locally in your browser.",
      title: "Convert video · ViteSakuga",
    }),
  }),
});
