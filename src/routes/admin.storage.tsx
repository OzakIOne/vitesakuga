import { createFileRoute, redirect } from "@tanstack/react-router";
import { StorageGcPanel } from "src/components/admin/StorageGcPanel";
import { hasPermission } from "src/lib/auth/capabilities";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/admin/storage")({
  beforeLoad: ({ context }) => {
    if (
      !hasPermission({
        capabilities: context.capabilities,
        permission: "storage:maintain",
      })
    ) {
      throw redirect({ to: "/admin" });
    }
  },
  component: StorageGcPanel,
  head: () => ({
    meta: seo({
      description: "Inspect and clean up unused ViteSakuga storage objects.",
      title: "Storage cleanup · ViteSakuga",
    }),
  }),
});
