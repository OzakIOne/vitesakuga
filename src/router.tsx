import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { DefaultCatchBoundary } from "./components/DefaultCatchBoundary";
import { NotFound } from "./components/NotFound";
import { getQueryClient } from "./lib/query-client";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryClient = getQueryClient();

  console.log("Running in", {
    mode: import.meta.env.MODE,
    url: import.meta.env["VITE_BASE_URL"],
  });

  const router = createTanStackRouter({
    context: {
      queryClient,
      user: null,
    },
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    defaultPreload: "intent",
    routeTree,
    scrollRestoration: true,
  });

  setupRouterSsrQueryIntegration({
    queryClient,
    router,
    // optional:
    // handleRedirects: true,
    // wrapQueryClient: true,
  });

  return router;
}

declare module "@tanstack/react-router" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- module augmentation must be an interface to merge with TanStack Router's Register declaration; a type alias cannot express this
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
