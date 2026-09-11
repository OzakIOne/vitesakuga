import { createFileRoute } from "@tanstack/react-router";
import { ReportsPanel } from "src/components/admin/ReportsPanel";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPanel,
  head: () => ({
    meta: seo({
      description: "Review reported posts on ViteSakuga.",
      title: "Reports · ViteSakuga",
    }),
  }),
});
