import { ClientOnly } from "@ark-ui/react";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { AdminTabs } from "src/components/admin/AdminTabs";
import { AdminSkeleton } from "src/components/LoadingSkeletons";
import { Container, Stack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import { hasPermission } from "src/lib/auth/capabilities";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/login" });
    }
    if (
      !hasPermission({
        capabilities: context.capabilities,
        permission: "moderation:view",
      })
    ) {
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
            <p className="text-tone-600 dark:text-tone-400 mt-2 max-w-2xl text-sm">
              Review community activity, resolve reports, and keep the archive
              healthy.
            </p>
          </header>
          <AdminTabs />
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
