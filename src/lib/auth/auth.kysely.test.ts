import { expect, it } from "vitest";

import { createE2EKysely } from "../db/e2e-db";
import { makeAuth } from "./index";

const SIGN_UP_EMAIL = "kysely.signup@gmail.com";

it("writes the sign-up user row through the Kysely adapter with the custom role and generated username", async () => {
  const db = await createE2EKysely();
  const auth = makeAuth({
    db,
    sendVerificationOTP: () => Promise.resolve(),
  });

  await auth.api.signUpEmail({
    body: {
      email: SIGN_UP_EMAIL,
      name: "Kysely Signup",
      password: "Harbor-Lantern-2026!",
    },
  });

  const row = await db
    .selectFrom("user")
    .select(["email", "role", "username"])
    .where("email", "=", SIGN_UP_EMAIL)
    .executeTakeFirstOrThrow();
  expect(row).toEqual({
    email: SIGN_UP_EMAIL,
    role: "novice",
    username: "kysely_signup",
  });
});
