import { createFileRoute, redirect } from "@tanstack/react-router";
import { AccountSuspensionPanel } from "src/components/admin/AccountSuspensionPanel";
import { ReportsPanel } from "src/components/admin/ReportsPanel";
import { Stack } from "src/components/ui/layout";
import { hasPermission } from "src/lib/auth/capabilities";
import { seo } from "src/utils/seo";

function ReportsAndSuspensions() {
  return (
    <Stack gap={8}>
      <ReportsPanel />
      <AccountSuspensionPanel />
    </Stack>
  );
}

export const Route = createFileRoute("/admin/reports")({
  beforeLoad: ({ context }) => {
    if (
      !hasPermission({
        capabilities: context.capabilities,
        permission: "moderation:view",
      })
    ) {
      throw redirect({ to: "/admin" });
    }
  },
  component: ReportsAndSuspensions,
  head: () => ({
    meta: seo({
      description: "Review reported posts and suspend accounts on ViteSakuga.",
      title: "Reports · ViteSakuga",
    }),
  }),
});
