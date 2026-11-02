import { Redacted } from "effect";
import { beforeAll, describe, expect, it } from "vitest";

import { createE2EKysely } from "../db/e2e-db";
import { envServer } from "../env/server";
import { makeAuth } from "./index";

let auth: ReturnType<typeof makeAuth>;

beforeAll(async () => {
  auth = makeAuth({
    db: await createE2EKysely(),
    sendVerificationOTP: () => Promise.resolve(),
  });
});

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

  it("requires a Resend-backed OTP before credential signup can create a session", () => {
    expect(auth.options.emailAndPassword).toMatchObject({
      requireEmailVerification: true,
    });
    const emailOtpPlugin = auth.options.plugins?.find(
      (plugin) => plugin.id === "email-otp",
    );
    expect(emailOtpPlugin?.options).toMatchObject({
      allowedAttempts: 5,
      expiresIn: 10 * 60,
      overrideDefaultEmailVerification: true,
      sendVerificationOnSignUp: true,
      storeOTP: "hashed",
    });
    expect(emailOtpPlugin?.options?.sendVerificationOTP).toBeTypeOf("function");
  });
});
