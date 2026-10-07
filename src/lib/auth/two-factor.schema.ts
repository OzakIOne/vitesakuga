import { Schema } from "effect";

export const TwoFactorRedirectSchema = Schema.Struct({
  twoFactorRedirect: Schema.Literal(true),
  twoFactorMethods: Schema.optional(Schema.Array(Schema.String)),
});
