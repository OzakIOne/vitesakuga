import { ClientOnly } from "@ark-ui/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { PromotionQueuePanel } from "src/components/admin/PromotionQueuePanel";
import { ReportsPanel } from "src/components/admin/ReportsPanel";
import { RolesPanel } from "src/components/admin/RolesPanel";
import { StorageGcPanel } from "src/components/admin/StorageGcPanel";
import { SuggestionsPanel } from "src/components/admin/SuggestionsPanel";
import { Spinner } from "src/components/ui/feedback";
import { Container, Stack } from "src/components/ui/layout";
import { Tabs } from "src/components/ui/tabs";
import { Text } from "src/components/ui/typography";
import { roleOf } from "src/lib/auth/roles";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/login" });
    }
    // Staff gate mirrors the server-side checks; every queue endpoint is
    // also staff-gated, so a stale client cannot read anything anyway.
    const staffRanks = ["moderator", "admin"];
    if (!staffRanks.includes(roleOf(context.user))) {
      throw redirect({ to: "/" });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  return (
    <ClientOnly fallback={<AdminLoading />}>
      <Container py={6}>
        <Stack gap={4}>
          <Tabs.Root defaultValue="promotions">
            <Tabs.List>
              <Tabs.Trigger value="promotions">Promotions</Tabs.Trigger>
              <Tabs.Trigger value="reports">Reports</Tabs.Trigger>
              <Tabs.Trigger value="suggestions">Suggestions</Tabs.Trigger>
              <Tabs.Trigger value="storage">Storage</Tabs.Trigger>
              <Tabs.Trigger value="roles">Roles</Tabs.Trigger>
            </Tabs.List>
            <Suspense fallback={<AdminLoading />}>
              <Tabs.Content value="promotions" p={4}>
                <PromotionQueuePanel />
              </Tabs.Content>
              <Tabs.Content value="reports" p={4}>
                <ReportsPanel />
              </Tabs.Content>
              <Tabs.Content value="suggestions" p={4}>
                <SuggestionsPanel />
              </Tabs.Content>
              <Tabs.Content value="storage" p={4}>
                <StorageGcPanel />
              </Tabs.Content>
              <Tabs.Content value="roles" p={4}>
                <RolesPanel />
              </Tabs.Content>
            </Suspense>
          </Tabs.Root>
        </Stack>
      </Container>
    </ClientOnly>
  );
}

function AdminLoading() {
  return (
    <Stack align="center" justify="center" minH="300px">
      <Spinner size="lg" />
      <Text>Loading moderation queues…</Text>
    </Stack>
  );
}
