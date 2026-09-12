import { ClientOnly } from "@ark-ui/react";
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
import { LuCheck, LuMenu } from "react-icons/lu";
import { DefaultCatchBoundary } from "src/components/DefaultCatchBoundary";
import { GlobalShortcuts } from "src/components/GlobalShortcuts";
import { NotFound } from "src/components/NotFound";
import { SkipToContentLink } from "src/components/SkipToContentLink";
import { Button, IconButton } from "src/components/ui/button";
import {
  COLOR_MODE_OPTIONS,
  ColorModeButton,
  useColorMode,
} from "src/components/ui/color-mode";
import { Box, Center } from "src/components/ui/layout";
import { Menu } from "src/components/ui/overlay";
import { Provider } from "src/components/ui/provider";
import { Toaster } from "src/components/ui/toaster";
import { Text } from "src/components/ui/typography";
import { getUserSession } from "src/lib/auth/auth.middleware";
import authClient from "src/lib/auth/client";
import { AuthClientContext } from "src/lib/auth/client-context";
import { roleOf } from "src/lib/auth/roles";
import {
  CommentsFnsContext,
  defaultCommentsFns,
} from "src/lib/comments/comments.fn-context";
import { useUnreadNotificationCount } from "src/lib/notifications/notifications.hooks";
import {
  PlaylistsFnsContext,
  defaultPlaylistsFns,
} from "src/lib/playlists/playlists.fn-context";
import {
  ReportsFnsContext,
  defaultReportsFns,
} from "src/lib/reports/reports.fn-context";
import { usersKeys } from "src/lib/users/users.queries";
import { seo } from "src/utils/seo";

import appCss from "src/styles/app.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user: Awaited<ReturnType<typeof getUserSession>>;
}>()({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.query({
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
      { href: "/favicon.ico", rel: "icon" },
      { href: "/site.webmanifest", rel: "manifest" },
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
      {
        content: "#ffffff",
        media: "(prefers-color-scheme: light)",
        name: "theme-color",
      },
      {
        content: "#0a0a0a",
        media: "(prefers-color-scheme: dark)",
        name: "theme-color",
      },
      ...seo({
        description:
          "An animation reference archive for browsing and sharing sakuga.",
        image: "/android-chrome-512x512.png",
        title: "ViteSakuga",
      }),
    ],
  }),
  notFoundComponent: () => <NotFound />,
});

const NAV_LINK_CLASS =
  "rounded px-2 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:outline-none dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white";
const ACTIVE_NAV_LINK_CLASS =
  "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

/**
 * Header inbox link with an unread badge. Polls lightly only while the
 * session exists; signed-out visitors never mount the query.
 */
function NotificationsLink() {
  const unread = useUnreadNotificationCount();

  return (
    <Link
      activeProps={{ className: ACTIVE_NAV_LINK_CLASS }}
      className={`${NAV_LINK_CLASS} relative inline-flex items-center gap-1 whitespace-nowrap`}
      to="/notifications"
    >
      Inbox
      {unread > 0 && (
        <Box
          alignItems="center"
          bg="red.500"
          borderRadius="full"
          color="white"
          display="inline-flex"
          fontSize="xs"
          justifyContent="center"
          minW={4}
          px={1}
        >
          {unread > 9 ? "9+" : unread}
        </Box>
      )}
    </Link>
  );
}

function ThemeMenuItems() {
  const { theme, setColorMode } = useColorMode();
  return (
    <>
      {COLOR_MODE_OPTIONS.map(({ value, label, icon }) => (
        <Menu.Item
          key={value}
          onClick={() => setColorMode(value)}
          value={`theme-${value}`}
        >
          {icon}
          <span className="flex-1">{label}</span>
          <ClientOnly>
            {theme === value && <LuCheck aria-hidden="true" />}
          </ClientOnly>
        </Menu.Item>
      ))}
    </>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const ctx = Route.useRouteContext();
  const queryClient = useQueryClient();
  const router = useRouter();
  const isStaff =
    ctx.user !== null && ["moderator", "admin"].includes(roleOf(ctx.user));

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
        <Provider>
          <SkipToContentLink />
          <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
            <nav aria-label="Main">
              <Center
                className="min-h-14 flex-wrap px-3 [&>a]:hidden md:[&>a]:inline-flex [&>a:first-child]:inline-flex"
                gap={1}
                py={2}
              >
                <Link
                  activeOptions={{ exact: true }}
                  activeProps={{
                    className: ACTIVE_NAV_LINK_CLASS,
                  }}
                  className={`${NAV_LINK_CLASS} whitespace-nowrap`}
                  to="/"
                >
                  Home
                </Link>{" "}
                <Link
                  activeProps={{
                    className: ACTIVE_NAV_LINK_CLASS,
                  }}
                  className={`${NAV_LINK_CLASS} whitespace-nowrap`}
                  to="/posts"
                >
                  Posts
                </Link>{" "}
                <Link
                  activeProps={{
                    className: ACTIVE_NAV_LINK_CLASS,
                  }}
                  className={`${NAV_LINK_CLASS} whitespace-nowrap`}
                  to="/random"
                >
                  Random video
                </Link>{" "}
                <Link
                  activeProps={{
                    className: ACTIVE_NAV_LINK_CLASS,
                  }}
                  className={`${NAV_LINK_CLASS} whitespace-nowrap`}
                  to="/users"
                >
                  Users
                </Link>{" "}
                <Link
                  activeProps={{
                    className: ACTIVE_NAV_LINK_CLASS,
                  }}
                  className={`${NAV_LINK_CLASS} whitespace-nowrap`}
                  to="/playlists"
                >
                  Playlists
                </Link>{" "}
                {ctx.user && (
                  <Link
                    activeProps={{
                      className: ACTIVE_NAV_LINK_CLASS,
                    }}
                    to="/account/playlists"
                    className={`${NAV_LINK_CLASS} whitespace-nowrap`}
                  >
                    My Playlists
                  </Link>
                )}{" "}
                {ctx.user && <NotificationsLink />}{" "}
                {ctx.user && isStaff && (
                  <Link
                    activeProps={{
                      className: ACTIVE_NAV_LINK_CLASS,
                    }}
                    to="/admin"
                    className={`${NAV_LINK_CLASS} whitespace-nowrap`}
                  >
                    Admin
                  </Link>
                )}{" "}
                <Link
                  activeProps={{
                    className: ACTIVE_NAV_LINK_CLASS,
                  }}
                  className={`${NAV_LINK_CLASS} whitespace-nowrap`}
                  to="/upload"
                >
                  Upload
                </Link>{" "}
                <Link
                  activeProps={{
                    className: ACTIVE_NAV_LINK_CLASS,
                  }}
                  className={`${NAV_LINK_CLASS} whitespace-nowrap`}
                  to="/convert"
                >
                  Convert video
                </Link>{" "}
                <Link
                  activeProps={{ className: ACTIVE_NAV_LINK_CLASS }}
                  className={`${NAV_LINK_CLASS} hidden whitespace-nowrap md:inline`}
                  to="/news"
                >
                  News
                </Link>{" "}
                <Link
                  activeProps={{ className: ACTIVE_NAV_LINK_CLASS }}
                  className={`${NAV_LINK_CLASS} hidden whitespace-nowrap md:inline`}
                  to="/wiki"
                >
                  Wiki
                </Link>{" "}
                <Link
                  activeProps={{ className: ACTIVE_NAV_LINK_CLASS }}
                  className={`${NAV_LINK_CLASS} hidden whitespace-nowrap md:inline`}
                  to="/help"
                >
                  Help
                </Link>{" "}
                {import.meta.env.DEV && (
                  <Box display={{ base: "none", md: "block" }}>
                    <Menu.Root>
                      <Menu.Trigger asChild>
                        <Button
                          size="xs"
                          variant="ghost"
                          className="whitespace-nowrap"
                        >
                          Dev Tools
                        </Button>
                      </Menu.Trigger>
                      <Menu.Positioner>
                        <Menu.Content>
                          <Menu.Item asChild value="otelite">
                            <a
                              href="http://localhost:4000"
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              Otelite
                            </a>
                          </Menu.Item>
                          <Menu.Item asChild value="opencode">
                            <a
                              href="http://localhost:4096"
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              Opencode
                            </a>
                          </Menu.Item>
                          <Menu.Item asChild value="signoz">
                            <a
                              href="http://localhost:8080"
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              SigNoz
                            </a>
                          </Menu.Item>
                        </Menu.Content>
                      </Menu.Positioner>
                    </Menu.Root>
                  </Box>
                )}{" "}
                <Box
                  alignItems="center"
                  display={{ base: "none", md: "flex" }}
                  gap={2}
                >
                  {ctx.user ? (
                    <>
                      <Link
                        activeProps={{ className: ACTIVE_NAV_LINK_CLASS }}
                        className={NAV_LINK_CLASS}
                        to="/account"
                      >
                        Account
                      </Link>{" "}
                      <Button onClick={handleSignOut} size="xs">
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    <>
                      <Link
                        className={NAV_LINK_CLASS}
                        search={redirectSearch}
                        to="/login"
                      >
                        Login
                      </Link>{" "}
                      <Link
                        className={NAV_LINK_CLASS}
                        search={redirectSearch}
                        to="/signup"
                      >
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
                        <Menu.Item asChild value="home">
                          <Link to="/">Home</Link>
                        </Menu.Item>
                        <Menu.Item asChild value="posts">
                          <Link to="/posts">Posts</Link>
                        </Menu.Item>
                        <Menu.Item asChild value="random">
                          <Link to="/random">Random video</Link>
                        </Menu.Item>
                        <Menu.Item asChild value="users">
                          <Link to="/users">Users</Link>
                        </Menu.Item>
                        <Menu.Item asChild value="playlists">
                          <Link to="/playlists">Playlists</Link>
                        </Menu.Item>
                        <Menu.Item asChild value="upload">
                          <Link to="/upload">Upload</Link>
                        </Menu.Item>
                        <Menu.Item asChild value="convert">
                          <Link to="/convert">Convert video</Link>
                        </Menu.Item>
                        <Menu.Item asChild value="news">
                          <Link to="/news">News</Link>
                        </Menu.Item>
                        <Menu.Item asChild value="wiki">
                          <Link to="/wiki">Wiki</Link>
                        </Menu.Item>
                        <Menu.Item asChild value="help">
                          <Link to="/help">Help</Link>
                        </Menu.Item>
                        <Menu.Separator />
                        {ctx.user ? (
                          <>
                            <Menu.Item asChild value="account">
                              <Link to="/account">Account</Link>
                            </Menu.Item>
                            <Menu.Item asChild value="my-playlists">
                              <Link to="/account/playlists">My Playlists</Link>
                            </Menu.Item>
                            <Menu.Item asChild value="notifications">
                              <Link to="/notifications">Inbox</Link>
                            </Menu.Item>
                            {isStaff && (
                              <Menu.Item asChild value="admin">
                                <Link to="/admin">Admin</Link>
                              </Menu.Item>
                            )}
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
                        <ThemeMenuItems />
                        {import.meta.env.DEV && (
                          <>
                            <Menu.Separator />
                            <Menu.Item asChild value="otelite">
                              <a
                                href="http://localhost:4000"
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                Otelite
                              </a>
                            </Menu.Item>
                            <Menu.Item asChild value="opencode">
                              <a
                                href="http://localhost:4096"
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                Opencode
                              </a>
                            </Menu.Item>
                            <Menu.Item asChild value="signoz">
                              <a
                                href="http://localhost:8080"
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                SigNoz
                              </a>
                            </Menu.Item>
                          </>
                        )}
                      </Menu.Content>
                    </Menu.Positioner>
                  </Menu.Root>
                </Box>
              </Center>
            </nav>
          </header>
          <main
            className="min-h-[calc(100dvh-8rem)]"
            id="main-content"
            tabIndex={-1}
          >
            {children}
          </main>
          <div
            aria-atomic="true"
            aria-live="polite"
            className="sr-only"
            id="route-announcer"
          />
          <footer className="border-t border-gray-200 px-4 py-6 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
              <Text>ViteSakuga — an animation reference archive.</Text>
              <nav aria-label="Footer">
                <div className="flex flex-wrap gap-4">
                  <Link className="hover:underline" to="/news">
                    News
                  </Link>
                  <Link className="hover:underline" to="/wiki">
                    Wiki
                  </Link>
                  <Link className="hover:underline" to="/help">
                    Help
                  </Link>
                </div>
              </nav>
            </div>
          </footer>
          <ClientOnly fallback={null}>
            <Toaster />
            {import.meta.env.DEV && (
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
            )}
          </ClientOnly>
          <Scripts />
        </Provider>
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <HotkeysProvider>
      <GlobalShortcuts />
      <AuthClientContext.Provider value={authClient}>
        <CommentsFnsContext.Provider value={defaultCommentsFns}>
          <PlaylistsFnsContext.Provider value={defaultPlaylistsFns}>
            <ReportsFnsContext.Provider value={defaultReportsFns}>
              <RootDocument>
                <Outlet />
              </RootDocument>
            </ReportsFnsContext.Provider>
          </PlaylistsFnsContext.Provider>
        </CommentsFnsContext.Provider>
      </AuthClientContext.Provider>
    </HotkeysProvider>
  );
}
