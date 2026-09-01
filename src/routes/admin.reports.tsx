import { createFileRoute } from "@tanstack/react-router";
import { ReportsPanel } from "src/components/admin/ReportsPanel";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPanel,
});
