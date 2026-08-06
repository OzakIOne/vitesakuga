import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";

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
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
