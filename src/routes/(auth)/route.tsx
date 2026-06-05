import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/(auth)")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: ({ context, search }) => {
    const redirectUrl = search.redirect || "/";
    if (context.user) {
      throw redirect({
        to: redirectUrl,
      });
    }
    return {
      redirectUrl,
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
