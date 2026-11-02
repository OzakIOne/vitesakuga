import { createFileRoute, redirect } from "@tanstack/react-router";
import { SuggestionsPanel } from "src/components/admin/SuggestionsPanel";
import { hasPermission } from "src/lib/auth/capabilities";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/admin/suggestions")({
  beforeLoad: ({ context }) => {
    if (
      !hasPermission({
        capabilities: context.capabilities,
        permission: "edits:approve",
      })
    ) {
      throw redirect({ to: "/admin" });
    }
  },
  component: SuggestionsPanel,
  head: () => ({
    meta: seo({
      description: "Review post edit suggestions on ViteSakuga.",
      title: "Edit suggestions · ViteSakuga",
    }),
  }),
});
