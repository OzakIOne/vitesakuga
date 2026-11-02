import { createFileRoute, redirect } from "@tanstack/react-router";
import { RolesPanel } from "src/components/admin/RolesPanel";
import { hasPermission } from "src/lib/auth/capabilities";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/admin/roles")({
  beforeLoad: ({ context }) => {
    if (
      !hasPermission({
        capabilities: context.capabilities,
        permission: "roles:assign",
      })
    ) {
      throw redirect({ to: "/admin" });
    }
  },
  component: RolesPanel,
  head: () => ({
    meta: seo({
      description: "Manage staff roles and permissions on ViteSakuga.",
      title: "Roles · ViteSakuga",
    }),
  }),
});
