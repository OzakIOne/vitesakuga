import { createFileRoute } from "@tanstack/react-router";
import { SuggestionsPanel } from "src/components/admin/SuggestionsPanel";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/admin/suggestions")({
  component: SuggestionsPanel,
  head: () => ({
    meta: seo({
      description: "Review post edit suggestions on ViteSakuga.",
      title: "Edit suggestions · ViteSakuga",
    }),
  }),
});
