import { passwordStrength, type Options } from "check-password-strength";

/**
 * Single source of truth for the password policy, shared by the client
 * schemas (`auth.schemas.ts`), the Better Auth server config
 * (`index.ts`: `minPasswordLength` + `hooks.before`), and the UI strength
 * meter (`password-input.tsx`). Keeping one definition means the meter can
 * never tell a user their password is fine while the server rejects it.
 */

/** Enforced server-side by Better Auth's `emailAndPassword.minPasswordLength`. */
export const MIN_PASSWORD_LENGTH = 12;

/** Same tiers the strength meter renders; ids map 0 weak → 3 strong. */
export const PASSWORD_STRENGTH_OPTIONS: Options<string> = [
  { id: 0, value: "weak", minDiversity: 0, minLength: 0 },
  { id: 1, value: "fair", minDiversity: 2, minLength: 6 },
  { id: 2, value: "good", minDiversity: 3, minLength: 8 },
  { id: 3, value: "strong", minDiversity: 4, minLength: 12 },
];

export type PasswordAssessment =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/**
 * Assess a candidate password against the policy: at least
 * `MIN_PASSWORD_LENGTH` characters mixing at least three of
 * lowercase / uppercase / digits / symbols (strength tier "good").
 */
export const assessPassword = (password: string): PasswordAssessment => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    };
  }

  const { id } = passwordStrength(password, PASSWORD_STRENGTH_OPTIONS);
  if (id < 2) {
    return {
      ok: false,
      reason:
        "Password must mix at least three of: lowercase letters, uppercase letters, digits, symbols",
    };
  }

  return { ok: true };
};
