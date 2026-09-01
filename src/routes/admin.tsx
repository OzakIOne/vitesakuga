import { ClientOnly } from "@ark-ui/react";
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
} from "@tanstack/react-router";
import { Suspense } from "react";
import { Spinner } from "src/components/ui/feedback";
import { Container, Stack } from "src/components/ui/layout";
import {
  TABS_LIST_BASE,
  TABS_TRIGGER_BASE,
  TABS_TRIGGER_SELECTED,
} from "src/components/ui/tabs";
import { Text } from "src/components/ui/typography";
import { roleOf } from "src/lib/auth/roles";

const ADMIN_TABS = [
  { label: "Promotions", to: "/admin/promotions" },
  { label: "Reports", to: "/admin/reports" },
  { label: "Suggestions", to: "/admin/suggestions" },
  { label: "Storage", to: "/admin/storage" },
  { label: "Roles", to: "/admin/roles" },
] as const;

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
  component: AdminLayout,
});

/**
 * Routed admin shell: the tab strip links to real sub-routes
 * (/admin/promotions, /admin/reports, …) so each panel is addressable.
 */
function AdminLayout() {
  return (
    <ClientOnly fallback={<AdminLoading />}>
      <Container py={6}>
        <Stack gap={4}>
          <nav aria-label="Admin sections">
            <div className={TABS_LIST_BASE}>
              {ADMIN_TABS.map((tab) => (
                <Link
                  activeOptions={{ exact: true }}
                  activeProps={{ className: TABS_TRIGGER_SELECTED }}
                  className={TABS_TRIGGER_BASE}
                  key={tab.to}
                  to={tab.to}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </nav>
          <Suspense fallback={<AdminLoading />}>
            <Outlet />
          </Suspense>
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
