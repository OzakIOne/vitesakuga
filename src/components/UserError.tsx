import type { ErrorComponentProps } from "@tanstack/react-router";

import { DefaultCatchBoundary } from "./DefaultCatchBoundary";

export function UserErrorComponent(props: ErrorComponentProps) {
  return <DefaultCatchBoundary {...props} />;
}
