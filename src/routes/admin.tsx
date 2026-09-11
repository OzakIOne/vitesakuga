import { ClientOnly } from "@ark-ui/react";
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
} from "@tanstack/react-router";
import { Suspense } from "react";
import { AdminSkeleton } from "src/components/LoadingSkeletons";
import { Container, Stack } from "src/components/ui/layout";
import {
  TABS_LIST_BASE,
  TABS_TRIGGER_BASE,
  TABS_TRIGGER_SELECTED,
} from "src/components/ui/tabs";
import { Text } from "src/components/ui/typography";
import { roleOf } from "src/lib/auth/roles";
import { seo } from "src/utils/seo";

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
  head: () => ({
    meta: seo({
      description: "Staff moderation tools for ViteSakuga.",
      noIndex: true,
      title: "Admin · ViteSakuga",
    }),
  }),
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
          <header>
            <Text color="gray.500" fontSize="sm">
              Staff workspace
            </Text>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Moderation dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
              Review community activity, resolve reports, and keep the archive
              healthy.
            </p>
          </header>
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
  return <AdminSkeleton />;
}
