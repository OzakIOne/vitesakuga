import { createFileRoute } from "@tanstack/react-router";
import { RolesPanel } from "src/components/admin/RolesPanel";

export const Route = createFileRoute("/admin/roles")({
  component: RolesPanel,
});
