import { createFileRoute } from "@tanstack/react-router";
import { SuggestionsPanel } from "src/components/admin/SuggestionsPanel";

export const Route = createFileRoute("/admin/suggestions")({
  component: SuggestionsPanel,
});
