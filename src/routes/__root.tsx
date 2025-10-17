import { QueryClient, useQueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import * as React from "react";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import appCss from "~/styles/app.css?url";
import { seo } from "~/utils/seo";
import { getUser } from "~/auth/utils";
import authClient from "~/auth/client";
import { Provider } from "~/components/ui/provider";
import { Button, Center } from "@chakra-ui/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { FormDevtools } from "@tanstack/react-form-devtools";
import { PacerDevtoolsPanel } from "@tanstack/react-pacer-devtools";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user: Awaited<ReturnType<typeof getUser>>;
}>()({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery({
      queryKey: ["user"],
      queryFn: ({ signal }) => getUser({ signal }),
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
