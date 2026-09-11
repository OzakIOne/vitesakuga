import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";
import { seo } from "src/utils/seo";

const AuthSearchSchema = Schema.Struct({
  redirect: Schema.optionalKey(Schema.String),
});

export const Route = createFileRoute("/(auth)")({
  validateSearch: Schema.toStandardSchemaV1(AuthSearchSchema),
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
  head: () => ({
    meta: seo({
      description: "Authentication pages for your ViteSakuga account.",
      noIndex: true,
      title: "Authentication · ViteSakuga",
    }),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
