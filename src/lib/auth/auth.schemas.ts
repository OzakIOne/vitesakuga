import { Schema } from "effect";

import { USERNAME_PATTERN } from "../mentions/mentions";
import { assessPassword, MIN_PASSWORD_LENGTH } from "./password-policy";

const Email = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
      message: "Please enter a valid email address",
    }),
  ),
);

const Url = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^https?:\/\/\S+$/, {
      message: "Please enter a valid URL starting with http(s)://",
    }),
  ),
);

export const loginSchema = Schema.Struct({
  email: Email,
  password: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
});

const PasswordMatch = Schema.makeFilter(
  (value: { password: string; confirm_password: string }) =>
    value.password === value.confirm_password
      ? undefined
      : "Passwords do not match",
);

// Shared by sign-up and password change; mirrors the server-side policy in
// `password-policy.ts` (Better Auth `minPasswordLength` + `hooks.before`),
// so the form rejects weak passwords before the request is ever sent.
const StrongPassword = Schema.String.pipe(
  Schema.check(
    Schema.isMinLength(MIN_PASSWORD_LENGTH, {
      message: `You must have a length of at least ${MIN_PASSWORD_LENGTH}`,
    }),
  ),
  Schema.check(
    Schema.makeFilter((password: string): string | undefined =>
      assessPassword(password).ok
        ? undefined
        : "Please choose a stronger password (mix lowercase, uppercase, digits or symbols)",
    ),
  ),
);

export const signUpSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.check(
      Schema.isMinLength(3, {
        message: "You must have a length of at least 3",
      }),
    ),
  ),
  email: Email,
  password: StrongPassword,
  confirm_password: Schema.String,
}).pipe(Schema.check(PasswordMatch));

export const profileSchema = Schema.Struct({
  image: Schema.Union([Url, Schema.Literal("")]),
  name: Schema.String,
  // @mention handle: unique server-side (Better Auth username plugin + DB
  // unique index); this check only gives fast, local feedback.
  username: Schema.String.pipe(
    Schema.check(
      Schema.isPattern(USERNAME_PATTERN, {
        message:
          "Use 3–30 lowercase letters, digits or underscores (no spaces)",
      }),
    ),
  ),
});

export const passwordSchema = Schema.Struct({
  currentPassword: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
  newPassword: StrongPassword,
});
