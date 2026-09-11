import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { DefaultCatchBoundary } from "./components/DefaultCatchBoundary";
import { NotFound } from "./components/NotFound";
import { RoutePending } from "./components/RoutePending";
import { getQueryClient } from "./lib/query-client";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryClient = getQueryClient();

  const router = createTanStackRouter({
    context: {
      queryClient,
      user: null,
    },
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    defaultPendingComponent: RoutePending,
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

  const documentRef = globalThis.document;
  if (documentRef) {
    router.subscribe("onRendered", ({ pathChanged }) => {
      if (!pathChanged) return;
      requestAnimationFrame(() => {
        const main = documentRef.getElementById("main-content");
        main?.focus({ preventScroll: true });

        const announcer = documentRef.getElementById("route-announcer");
        if (announcer) {
          const pageHeading = main?.querySelector("h1")?.textContent?.trim();
          announcer.textContent = pageHeading || documentRef.title;
        }
      });
    });
  }

  return router;
}

declare module "@tanstack/react-router" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- module augmentation must be an interface to merge with TanStack Router's Register declaration; a type alias cannot express this
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
