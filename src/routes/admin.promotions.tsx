import { createFileRoute } from "@tanstack/react-router";
import { PromotionQueuePanel } from "src/components/admin/PromotionQueuePanel";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/admin/promotions")({
  component: PromotionQueuePanel,
  head: () => ({
    meta: seo({
      description: "Review uploader promotion requests on ViteSakuga.",
      title: "Promotion queue · ViteSakuga",
    }),
  }),
});
