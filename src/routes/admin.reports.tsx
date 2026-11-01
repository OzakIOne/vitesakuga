import { createFileRoute } from "@tanstack/react-router";
import { AccountSuspensionPanel } from "src/components/admin/AccountSuspensionPanel";
import { ReportsPanel } from "src/components/admin/ReportsPanel";
import { Stack } from "src/components/ui/layout";
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
  component: ReportsAndSuspensions,
  head: () => ({
    meta: seo({
      description: "Review reported posts and suspend accounts on ViteSakuga.",
      title: "Reports · ViteSakuga",
    }),
  }),
});
