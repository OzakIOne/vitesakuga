import { describe, expect, it } from "vitest";

import { getPasswordStrength } from "./password-input";

describe("getPasswordStrength", () => {
  it("returns score 0 for an empty password", () => {
    expect(getPasswordStrength("")).toEqual({ score: 0, level: "weak" });
  });

  it("rates a short single-class password as weak", () => {
    expect(getPasswordStrength("abc")).toEqual({ score: 1, level: "weak" });
  });

  it("rates two character classes of 6+ chars as fair", () => {
    expect(getPasswordStrength("abc123")).toEqual({
      score: 2,
      level: "fair",
    });
  });

  it("rates three character classes of 8+ chars as good", () => {
    expect(getPasswordStrength("Password1")).toEqual({
      score: 3,
      level: "good",
    });
  });

  it("rates all four character classes of 12+ chars as strong", () => {
    expect(getPasswordStrength("P@ssw0rd12345")).toEqual({
      score: 4,
      level: "strong",
    });
  });
});
