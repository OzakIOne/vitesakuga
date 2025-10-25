import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    const REDIRECT_URL = "/";
    if (context.user) {
      throw redirect({
        to: REDIRECT_URL,
      });
    }
    return {
      redirectUrl: REDIRECT_URL,
    };
  },
});

function RouteComponent() {
  return <Outlet />;
}
