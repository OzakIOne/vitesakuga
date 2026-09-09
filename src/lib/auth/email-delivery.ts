import { Redacted } from "effect";

import { envServer } from "../env/server";

type VerificationEmailType =
  | "sign-in"
  | "email-verification"
  | "forget-password"
  | "change-email";

type ResendEmailResponse = {
  readonly id?: unknown;
};

const RESEND_EMAIL_API = "https://api.resend.com/emails";

function isResendEmailResponse(
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Resend's REST response is an untrusted boundary; this guard narrows it before use.
  value: unknown,
): value is ResendEmailResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    value.id.length > 0
  );
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
 * Better Auth's email-OTP adapter. Resend is called over its REST API so the
 * same implementation works in a Cloudflare Worker and in local Node-based
 * previews without requiring an extra mail SDK.
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
  const apiKey = Redacted.value(envServer.RESEND_API_KEY);
  const from = envServer.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error(
      "Resend is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
    );
  }

  const escapedOtp = escapeHtml(otp);
  const subject = subjectFor(type);
  // oxlint-disable-next-line effecttsgo/global-fetch -- Resend is the external transport boundary.
  const response = await fetch(RESEND_EMAIL_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      html: `<p>Your ViteSakuga verification code is <strong>${escapedOtp}</strong>.</p><p>This code expires in 10 minutes.</p>`,
      subject,
      text: `Your ViteSakuga verification code is ${otp}. This code expires in 10 minutes.`,
      to: email,
    }),
  });

  if (!response.ok) {
    throw new Error("Resend rejected the verification email.");
  }

  const result: unknown = await response.json();
  if (!isResendEmailResponse(result)) {
    throw new Error("Resend rejected the verification email.");
  }
}
