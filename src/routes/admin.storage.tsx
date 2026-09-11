import { createFileRoute } from "@tanstack/react-router";
import { StorageGcPanel } from "src/components/admin/StorageGcPanel";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/admin/storage")({
  component: StorageGcPanel,
  head: () => ({
    meta: seo({
      description: "Inspect and clean up unused ViteSakuga storage objects.",
      title: "Storage cleanup · ViteSakuga",
    }),
  }),
});
