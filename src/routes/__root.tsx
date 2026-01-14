import { Box, Button, Center } from "@chakra-ui/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { FormDevtoolsPanel } from "@tanstack/react-form-devtools";
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
import { ColorModeButton } from "src/components/ui/color-mode";
import { Provider } from "src/components/ui/provider";
import { Toaster } from "src/components/ui/toaster";
import { getUserSession } from "src/lib/auth/auth.middleware";
import authClient from "src/lib/auth/client";
import { usersKeys } from "src/lib/users/users.queries";
import appCss from "src/styles/app.css?url";
import { seo } from "src/utils/seo";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user: Awaited<ReturnType<typeof getUserSession>>;
}>()({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery({
      queryFn: ({ signal }) => getUserSession({ signal }),
      queryKey: ["user"],
      staleTime: 60 * 60 * 1000,
    }); // we're using react-query for caching, see router.tsx
    return { user };
  },
  component: RootComponent,
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },
  head: () => ({
    links: [
      { href: appCss, rel: "stylesheet" },
      {
        href: "/apple-touch-icon.png",
        rel: "apple-touch-icon",
        sizes: "180x180",
      },
      {
        href: "/favicon-32x32.png",
        rel: "icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        href: "/favicon-16x16.png",
        rel: "icon",
        sizes: "16x16",
        type: "image/png",
      },
      { color: "#fffff", href: "/site.webmanifest", rel: "manifest" },
      { href: "/favicon.ico", rel: "icon" },
    ],
    meta: [
      {
        charSet: "utf-8",
      },
      {
        content: "width=device-width, initial-scale=1",
        name: "viewport",
      },
      ...seo({
        description: "Sakugabooru clone made with tanstack.",
        title: "Vitesakuga",
      }),
    ],
  }),
  notFoundComponent: () => <NotFound />,
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://unpkg.com/react-scan/dist/auto.global.js" />
        <HeadContent />
      </head>
      <body>
        <Center
          gap={2}
          left={0}
          position="absolute"
          py={2}
          right={0}
          top={0}
          zIndex={10}
        >
          <Link
            activeOptions={{ exact: true }}
            activeProps={{
              className: "link",
            }}
            to="/"
          >
            Home
          </Link>{" "}
          <Link
            activeProps={{
              className: "link",
            }}
            className=""
            to="/posts"
          >
            Posts
          </Link>{" "}
          <Link
            activeProps={{
              className: "link",
            }}
            to="/users"
          >
            Users
          </Link>{" "}
          <Link
            activeProps={{
              className: "link",
            }}
            to="/upload"
          >
            Upload
          </Link>{" "}
          <Link
            activeProps={{
              className: "link",
            }}
            to="/convert"
          >
            Convert video
          </Link>{" "}
          {ctx.user ? (
            <>
              <Link className="link" to="/account">
                Account
              </Link>{" "}
              <Button
                onClick={async () => {
                  await authClient.signOut();
                  await queryClient.invalidateQueries({
                    queryKey: usersKeys.user,
                  });
                  await router.invalidate();
                }}
                size="xs"
              >
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link className="link" to="/login">
                Login
              </Link>{" "}
              <Link className="link" to="/signup">
                Sign Up
              </Link>
            </>
          )}
          <ColorModeButton />
        </Center>
        <Box pt={16}>{children}</Box>
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
              render: <FormDevtoolsPanel />,
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
