import { describe, expect, it } from "vitest";

import {
  emailDomain,
  isAllowedSignupEmail,
  isTrustedEmailDomain,
} from "./email-policy";

describe("email signup policy", () => {
  it("accepts established providers and privacy relay aliases", () => {
    expect(isAllowedSignupEmail("Alice@GMAIL.COM")).toBe(true);
    expect(isAllowedSignupEmail("relay-user@privaterelay.appleid.com")).toBe(
      true,
    );
    expect(isAllowedSignupEmail("user@pm.me")).toBe(true);
  });

  it("requires exact domains instead of trusting lookalike suffixes", () => {
    expect(isTrustedEmailDomain("gmail.com.example.org")).toBe(false);
    expect(isAllowedSignupEmail("user@gmail.com.example.org")).toBe(false);
    expect(isAllowedSignupEmail("user@notgmail.com")).toBe(false);
  });

  it("normalizes domain casing and a trailing dot", () => {
    expect(emailDomain("user@icloud.com.")).toBe("icloud.com");
    expect(isAllowedSignupEmail("user@icloud.com.")).toBe(true);
  });
});
