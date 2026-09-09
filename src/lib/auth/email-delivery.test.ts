import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../env/server", async () => {
  const { Redacted } = await import("effect");

  return {
    envServer: {
      EMAIL_FROM: "ViteSakuga <onboarding@resend.dev>",
      RESEND_API_KEY: Redacted.make("re_test_key"),
    },
  };
});

import { sendVerificationOTP } from "./email-delivery";

describe("sendVerificationOTP", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the verification code through Resend", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "email-id" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await sendVerificationOTP({
      email: "alice@example.com",
      otp: "12<456",
      type: "email-verification",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer re_test_key",
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(request.body as string)).toEqual({
      from: "ViteSakuga <onboarding@resend.dev>",
      html: expect.stringContaining("12&lt;456"),
      subject: "Verify your ViteSakuga email",
      text: "Your ViteSakuga verification code is 12<456. This code expires in 10 minutes.",
      to: "alice@example.com",
    });
  });

  it("rejects unsuccessful Resend responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "invalid from" }), {
        status: 400,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendVerificationOTP({
        email: "alice@example.com",
        otp: "123456",
        type: "email-verification",
      }),
    ).rejects.toThrow("Resend rejected the verification email.");
  });
});
