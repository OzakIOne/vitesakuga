import { createFileRoute, redirect } from "@tanstack/react-router";
import { AccountPage } from "src/features/account/account-page";
import { getAccountSecurity } from "src/lib/auth/account-security";
import { usersKeys } from "src/lib/users/users.queries";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/account")({
  beforeLoad: async ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        search: { redirect: location.pathname },
        to: "/login",
      });
    }
    const security = await context.queryClient.query({
      queryKey: usersKeys.accountSecurity,
      queryFn: async ({ signal }) => getAccountSecurity({ signal }),
      staleTime: 60 * 60 * 1000,
    });
    return { user: context.user, hasPassword: security.hasPassword };
  },
  component: AccountRoute,
  head: () => ({
    meta: seo({
      description:
        "Manage your ViteSakuga profile, security, and account settings.",
      noIndex: true,
      title: "Account settings · ViteSakuga",
    }),
  }),
});

function AccountRoute() {
  const { hasPassword, user } = Route.useRouteContext();

  return <AccountPage hasPassword={hasPassword} user={user} />;
}
