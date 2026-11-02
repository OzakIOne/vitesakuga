import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  TABS_LIST_BASE,
  TABS_TRIGGER_BASE,
  TABS_TRIGGER_SELECTED,
} from "src/components/ui/tabs";
import { useCapabilities } from "src/lib/auth/capabilities.context";

const ADMIN_TABS = [
  {
    label: "Promotions",
    permission: "promotions:review",
    to: "/admin/promotions",
  },
  { label: "Reports", permission: "moderation:view", to: "/admin/reports" },
  {
    label: "Suggestions",
    permission: "edits:approve",
    to: "/admin/suggestions",
  },
  { label: "Storage", permission: "storage:maintain", to: "/admin/storage" },
  { label: "Roles", permission: "roles:assign", to: "/admin/roles" },
] as const;

export const AdminTabs = () => {
  const { can } = useCapabilities();
  const links: ReactNode[] = [];

  for (const tab of ADMIN_TABS) {
    if (!can(tab.permission)) continue;

    links.push(
      <Link
        activeOptions={{ exact: true }}
        activeProps={{ className: TABS_TRIGGER_SELECTED }}
        className={TABS_TRIGGER_BASE}
        key={tab.to}
        to={tab.to}
      >
        {tab.label}
      </Link>,
    );
  }

  return (
    <nav aria-label="Admin sections">
      <div className={TABS_LIST_BASE}>{links}</div>
    </nav>
  );
};
