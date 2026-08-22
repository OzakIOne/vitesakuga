import { describe, expect, it } from "vitest";

import {
  assessPassword,
  MIN_PASSWORD_LENGTH,
  PASSWORD_STRENGTH_OPTIONS,
} from "./password-policy";

describe("assessPassword", () => {
  it.each([["Ab1!6789012", MIN_PASSWORD_LENGTH - 1]])(
    "rejects passwords shorter than $2 characters",
    (password) => {
      const assessment = assessPassword(password);
      expect(assessment).toEqual({
        ok: false,
        reason: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      });
    },
  );

  it("rejects a minimum-length password with a single character class", () => {
    expect(assessPassword("abcdefghijkl")).toEqual({
      ok: false,
      reason:
        "Password must mix at least three of: lowercase letters, uppercase letters, digits, symbols",
    });
  });

  it("rejects a minimum-length password with two character classes", () => {
    expect(assessPassword("abcdefgh1234").ok).toBe(false);
  });

  it("accepts a password mixing three character classes", () => {
    expect(assessPassword("Abcdefghij12")).toEqual({ ok: true });
  });

  it("accepts a password mixing all four character classes", () => {
    expect(assessPassword("Abcdefgh123!xyz")).toEqual({ ok: true });
  });
});

describe("PASSWORD_STRENGTH_OPTIONS", () => {
  it("keeps the strong tier aligned with the minimum length", () => {
    const strongest = PASSWORD_STRENGTH_OPTIONS.at(-1);
    expect(strongest?.minLength).toBe(MIN_PASSWORD_LENGTH);
  });
});
