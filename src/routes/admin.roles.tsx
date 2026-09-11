import { createFileRoute } from "@tanstack/react-router";
import { RolesPanel } from "src/components/admin/RolesPanel";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/admin/roles")({
  component: RolesPanel,
  head: () => ({
    meta: seo({
      description: "Manage staff roles and permissions on ViteSakuga.",
      title: "Roles · ViteSakuga",
    }),
  }),
});
