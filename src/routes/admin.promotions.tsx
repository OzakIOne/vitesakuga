import { createFileRoute, redirect } from "@tanstack/react-router";
import { PromotionQueuePanel } from "src/components/admin/PromotionQueuePanel";
import { hasPermission } from "src/lib/auth/capabilities";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/admin/promotions")({
  beforeLoad: ({ context }) => {
    if (
      !hasPermission({
        capabilities: context.capabilities,
        permission: "promotions:review",
      })
    ) {
      throw redirect({ to: "/admin" });
    }
  },
  component: PromotionQueuePanel,
  head: () => ({
    meta: seo({
      description: "Review uploader promotion requests on ViteSakuga.",
      title: "Promotion queue · ViteSakuga",
    }),
  }),
});
