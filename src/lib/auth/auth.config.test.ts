import { Redacted } from "effect";
import { auth } from "src/lib/auth";
import { envServer } from "src/lib/env/server";
import { describe, expect, it } from "vitest";

describe("auth server config", () => {
  it("decodes the GitHub client secret as a recoverable Redacted", () => {
    expect(Redacted.value(envServer.GITHUB_CLIENT_SECRET)).toBe(
      "test-client-secret",
    );
  });

  it("registers the GitHub social provider with the provisioned credentials", () => {
    expect(auth.options.socialProviders?.github).toMatchObject({
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
    });
  });

  it("allows managing 2FA without a password for OAuth-only users", () => {
    const twoFactorPlugin = auth.options.plugins?.find(
      (plugin) => plugin.id === "two-factor",
    );
    expect(twoFactorPlugin?.options).toMatchObject({ allowPasswordless: true });
  });
});
