import { Button, Center } from "@chakra-ui/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { FormDevtools } from "@tanstack/react-form-devtools";
import { PacerDevtoolsPanel } from "@tanstack/react-pacer-devtools";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type * as React from "react";
import { DefaultCatchBoundary } from "src/components/DefaultCatchBoundary";
import { NotFound } from "src/components/NotFound";
import { Provider } from "src/components/ui/provider";
import { Toaster } from "src/components/ui/toaster";
import { getUserSession } from "src/lib/auth/auth.middleware";
import authClient from "src/lib/auth/client";
import appCss from "src/styles/app.css?url";
import { seo } from "src/utils/seo";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user: Awaited<ReturnType<typeof getUserSession>>;
}>()({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery({
      queryKey: ["user"],
      queryFn: ({ signal }) => getUserSession({ signal }),
      staleTime: 60 * 60 * 1000,
    }); // we're using react-query for caching, see router.tsx
    return { user };
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      ...seo({
        title: "Vitesakuga",
        description: `Sakugabooru clone made with tanstack.`,
      }),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      { rel: "manifest", href: "/site.webmanifest", color: "#fffff" },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <Provider>
      <RootDocument>
        <Outlet />
      </RootDocument>
    </Provider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const ctx = Route.useRouteContext();
  const queryClient = useQueryClient();
  const router = useRouter();

  return (
    <html lang="en">
      <head>
        <script src="https://unpkg.com/react-scan/dist/auto.global.js" />
        <HeadContent />
      </head>
      <body>
        <Center gap={2}>
          <Link
            to="/"
            activeProps={{
              className: "link",
            }}
            activeOptions={{ exact: true }}
          >
            Home
          </Link>{" "}
          <Link
            className=""
            to="/posts"
            activeProps={{
              className: "link",
            }}
          >
            Posts
          </Link>{" "}
          <Link
            to="/users"
            activeProps={{
              className: "link",
            }}
          >
            Users
          </Link>{" "}
          <Link
            to="/upload"
            activeProps={{
              className: "link",
            }}
          >
            Upload
          </Link>{" "}
          <Link
            to="/convert"
            activeProps={{
              className: "link",
            }}
          >
            Convert video
          </Link>{" "}
          {ctx.user ? (
            <>
              <Link to="/account" className="link">
                Account
              </Link>{" "}
              <Button
                size="xs"
                onClick={async () => {
                  await authClient.signOut();
                  await queryClient.invalidateQueries({ queryKey: ["user"] });
                  await router.invalidate();
                }}
              >
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="link">
                Login
              </Link>{" "}
              <Link to="/signup" className="link">
                Sign Up
              </Link>
            </>
          )}
        </Center>
        <hr />
        {children}
        <Toaster />
        <TanStackDevtools
          plugins={[
            {
              name: "TanStack Query",
              render: <ReactQueryDevtoolsPanel />,
            },
            {
              name: "TanStack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            {
              name: "TanStack Form",
              render: <FormDevtools />,
            },
            {
              name: "TanStack Pacer",
              render: <PacerDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
