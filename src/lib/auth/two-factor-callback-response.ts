import { Schema } from "effect";

import { TwoFactorRedirectSchema } from "./two-factor.schema";

const oauthCallbackPathPattern = /^\/api\/auth\/callback\/[^/]+$/;

export const redirectTwoFactorOAuthCallback = async (input: {
  request: Request;
  response: Response;
}) => {
  if (!oauthCallbackPathPattern.test(new URL(input.request.url).pathname)) {
    return input.response;
  }

  const responseBody: unknown = await input.response
    .clone()
    .json()
    .catch(() => undefined);
  if (!Schema.is(TwoFactorRedirectSchema)(responseBody)) {
    return input.response;
  }

  const headers = new Headers(input.response.headers);
  headers.set("Location", "/two-factor");
  headers.delete("Content-Length");
  headers.delete("Content-Type");

  return new Response(null, { headers, status: 303 });
};
