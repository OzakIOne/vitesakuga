import { Redacted } from "effect";

import { envServer } from "../env/server";

type VerificationEmailType =
  | "sign-in"
  | "email-verification"
  | "forget-password"
  | "change-email";

type CloudflareEmailResponse = {
  readonly success?: unknown;
};

const CLOUDFLARE_EMAIL_API = "https://api.cloudflare.com/client/v4/accounts";

function isCloudflareEmailResponse(
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Cloudflare's REST response is an untrusted boundary; this guard narrows it before use.
  value: unknown,
): value is CloudflareEmailResponse {
  return typeof value === "object" && value !== null && "success" in value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function subjectFor(type: VerificationEmailType): string {
  switch (type) {
    case "email-verification":
      return "Verify your ViteSakuga email";
    case "sign-in":
      return "Your ViteSakuga sign-in code";
    case "forget-password":
      return "Your ViteSakuga password reset code";
    case "change-email":
      return "Confirm your ViteSakuga email change";
  }
}

/**
 * Better Auth's email-OTP adapter. Cloudflare Email Service is called over
 * its REST API so the same implementation works in a Cloudflare Worker and
 * in local Node-based previews without requiring an extra mail SDK.
 */
// oxlint-disable-next-line effecttsgo/async-function -- Better Auth owns this Promise-returning email transport callback.
export async function sendVerificationOTP({
  email,
  otp,
  type,
}: {
  email: string;
  otp: string;
  type: VerificationEmailType;
}): Promise<void> {
  const accountId = envServer.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = Redacted.value(envServer.CLOUDFLARE_EMAIL_API_TOKEN);
  const from = envServer.EMAIL_FROM;

  if (!accountId || !apiToken || !from) {
    throw new Error(
      "Cloudflare Email Service is not configured. Set CLOUDFLARE_EMAIL_API_TOKEN and EMAIL_FROM.",
    );
  }

  const escapedOtp = escapeHtml(otp);
  const subject = subjectFor(type);
  // oxlint-disable-next-line effecttsgo/global-fetch -- Cloudflare Email Service is the external transport boundary.
  const response = await fetch(
    `${CLOUDFLARE_EMAIL_API}/${encodeURIComponent(accountId)}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        html: `<p>Your ViteSakuga verification code is <strong>${escapedOtp}</strong>.</p><p>This code expires in 10 minutes.</p>`,
        subject,
        text: `Your ViteSakuga verification code is ${otp}. This code expires in 10 minutes.`,
        to: email,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      "Cloudflare Email Service rejected the verification email.",
    );
  }

  const result: unknown = await response.json();
  if (!isCloudflareEmailResponse(result) || result.success !== true) {
    throw new Error(
      "Cloudflare Email Service rejected the verification email.",
    );
  }
}
