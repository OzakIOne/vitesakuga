import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import type { UserCapabilities } from "src/lib/auth/capabilities";
import { CapabilitiesProvider } from "src/lib/auth/capabilities.context";
import { expect, describe, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { AdminTabs } from "./AdminTabs";

const renderTabs = async (capabilities: UserCapabilities) => {
  const rootRoute = createRootRoute({
    component: () => (
      <CapabilitiesProvider capabilities={capabilities}>
        <Outlet />
      </CapabilitiesProvider>
    ),
  });
  const routes = [
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/admin",
      component: AdminTabs,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/admin/promotions",
      component: () => null,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/admin/reports",
      component: () => null,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/admin/suggestions",
      component: () => null,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/admin/storage",
      component: () => null,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/admin/roles",
      component: () => null,
    }),
  ];
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/admin"] }),
    routeTree: rootRoute.addChildren(routes),
  });

  await render(<RouterProvider router={router} />);
  await router.load();
};

const moderatorCapabilities: UserCapabilities = {
  actorId: "moderator-1",
  hasMutationActor: true,
  permissions: ["moderation:view", "edits:approve", "promotions:review"],
  suspended: false,
  suspensionReason: null,
};

const adminCapabilities: UserCapabilities = {
  ...moderatorCapabilities,
  actorId: "admin-1",
  permissions: [
    "moderation:view",
    "edits:approve",
    "promotions:review",
    "storage:maintain",
    "roles:assign",
  ],
};

describe("AdminTabs", () => {
  it("omits admin-only tabs for moderators", async () => {
    await renderTabs(moderatorCapabilities);

    await expect(
      page.getByRole("navigation", { name: "Admin sections" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Promotions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reports" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Suggestions" })).toBeVisible();
    expect(page.getByRole("link", { name: "Storage" }).query()).toBeNull();
    expect(page.getByRole("link", { name: "Roles" }).query()).toBeNull();
  });

  it("shows every tab to administrators", async () => {
    await renderTabs(adminCapabilities);

    await expect(page.getByRole("link", { name: "Promotions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reports" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Suggestions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Storage" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Roles" })).toBeVisible();
  });
});
