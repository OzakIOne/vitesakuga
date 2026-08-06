import { Schema } from "effect";

const Email = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
);

const Url = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^https?:\/\/\S+$/)),
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

export const signUpSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.check(
      Schema.isMinLength(3, {
        message: "You must have a length of at least 3",
      }),
    ),
  ),
  email: Email,
  password: Schema.String.pipe(
    Schema.check(
      Schema.isMinLength(8, {
        message: "You must have a length of at least 8",
      }),
    ),
  ),
  confirm_password: Schema.String,
}).pipe(Schema.check(PasswordMatch));

export const profileSchema = Schema.Struct({
  image: Schema.Union([Url, Schema.Literal("")]),
  name: Schema.String,
});

export const passwordSchema = Schema.Struct({
  currentPassword: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
  newPassword: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
});
