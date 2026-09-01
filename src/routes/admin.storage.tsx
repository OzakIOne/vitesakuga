import { createFileRoute } from "@tanstack/react-router";
import { StorageGcPanel } from "src/components/admin/StorageGcPanel";

export const Route = createFileRoute("/admin/storage")({
  component: StorageGcPanel,
});
