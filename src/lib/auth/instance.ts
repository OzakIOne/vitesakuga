import { authKysely } from "../db/kysely";
import { sendVerificationOTP } from "./email-delivery";
import { makeAuth } from "./index";

export const auth = makeAuth({
  db: authKysely,
  sendVerificationOTP,
});
