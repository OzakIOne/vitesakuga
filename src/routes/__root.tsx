import {
  Box,
  Button,
  Center,
  ClientOnly,
  IconButton,
  Menu,
} from "@chakra-ui/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { FormDevtoolsPanel } from "@tanstack/react-form-devtools";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { PacerDevtoolsPanel } from "@tanstack/react-pacer-devtools";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type * as React from "react";
import { LuMenu } from "react-icons/lu";
import { DefaultCatchBoundary } from "src/components/DefaultCatchBoundary";
import { GlobalShortcuts } from "src/components/GlobalShortcuts";
import { NotFound } from "src/components/NotFound";
import { ColorModeButton, useColorMode } from "src/components/ui/color-mode";
import { Provider } from "src/components/ui/provider";
import { Toaster } from "src/components/ui/toaster";
import { getUserSession } from "src/lib/auth/auth.middleware";
import authClient from "src/lib/auth/client";
import { AuthClientContext } from "src/lib/auth/client-context";
import {
  CommentsFnsContext,
  defaultCommentsFns,
} from "src/lib/comments/comments.fn-context";
import { usersKeys } from "src/lib/users/users.queries";
import { seo } from "src/utils/seo";

import appCss from "src/styles/app.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user: Awaited<ReturnType<typeof getUserSession>>;
}>()({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery({
      queryFn: async ({ signal }) => getUserSession({ signal }),
      queryKey: usersKeys.userInfo,
      staleTime: 60 * 60 * 1000,
    });
    return { user };
  },
  component: RootComponent,
  errorComponent: (props) => (
    <RootDocument>
      <DefaultCatchBoundary {...props} />
    </RootDocument>
  ),
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
    scripts: [],
    meta: [
      {
        charSet: "utf8",
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

function RootDocument({ children }: { children: React.ReactNode }) {
  const ctx = Route.useRouteContext();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toggleColorMode } = useColorMode();

  const currentPath = router.state.location.pathname;
  const authPaths = ["/login", "/signup"];
  const hasRedirect = currentPath !== "/" && !authPaths.includes(currentPath);
  const redirectSearch = hasRedirect
    ? ({ redirect: currentPath } as const)
    : {};

  const handleSignOut = () => {
    void (async () => {
      await authClient.signOut();
      await queryClient.invalidateQueries({
        queryKey: usersKeys.userInfo,
      });
      await router.invalidate();
    })();
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
          <Box
            alignItems="center"
            display={{ base: "none", md: "flex" }}
            gap={2}
          >
            {ctx.user ? (
              <>
                <Link className="link" to="/account">
                  Account
                </Link>{" "}
                <Button onClick={handleSignOut} size="xs">
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link className="link" search={redirectSearch} to="/login">
                  Login
                </Link>{" "}
                <Link className="link" search={redirectSearch} to="/signup">
                  Sign Up
                </Link>
              </>
            )}
            <ColorModeButton />
          </Box>
          <Box display={{ base: "flex", md: "none" }}>
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton aria-label="Menu" size="sm" variant="ghost">
                  <LuMenu />
                </IconButton>
              </Menu.Trigger>
              <Menu.Positioner>
                <Menu.Content>
                  {ctx.user ? (
                    <>
                      <Menu.Item asChild value="account">
                        <Link to="/account">Account</Link>
                      </Menu.Item>
                      <Menu.Item onClick={handleSignOut} value="signout">
                        Sign Out
                      </Menu.Item>
                    </>
                  ) : (
                    <>
                      <Menu.Item asChild value="login">
                        <Link search={redirectSearch} to="/login">
                          Login
                        </Link>
                      </Menu.Item>
                      <Menu.Item asChild value="signup">
                        <Link search={redirectSearch} to="/signup">
                          Sign Up
                        </Link>
                      </Menu.Item>
                    </>
                  )}
                  <Menu.Separator />
                  <Menu.Item onClick={toggleColorMode} value="theme">
                    Toggle Theme
                  </Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
          </Box>
        </Center>
        <Box pt={16}>{children}</Box>
        <ClientOnly fallback={null}>
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
        </ClientOnly>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <Provider>
      <HotkeysProvider>
        <GlobalShortcuts />
        <AuthClientContext.Provider value={authClient}>
          <CommentsFnsContext.Provider value={defaultCommentsFns}>
            <RootDocument>
              <Outlet />
            </RootDocument>
          </CommentsFnsContext.Provider>
        </AuthClientContext.Provider>
      </HotkeysProvider>
    </Provider>
  );
}
