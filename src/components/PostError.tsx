import type { ErrorComponentProps } from "@tanstack/react-router";

import { DefaultCatchBoundary } from "./DefaultCatchBoundary";

export function PostErrorComponent(props: ErrorComponentProps) {
  return <DefaultCatchBoundary {...props} />;
}
