import { createFileRoute } from "@tanstack/react-router";
import { PromotionQueuePanel } from "src/components/admin/PromotionQueuePanel";

export const Route = createFileRoute("/admin/promotions")({
  component: PromotionQueuePanel,
});
