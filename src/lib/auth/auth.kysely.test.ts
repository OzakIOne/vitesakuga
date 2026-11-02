import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Kysely } from "kysely";
import { expect, it } from "vitest";

import { createE2EKysely } from "../db/e2e-db";
import type { DB } from "../db/kysely";
import { PGliteDialect } from "../db/pglite-driver";
import { envServer } from "../env/server";
import { makeAuth } from "./index";

const SIGN_UP_EMAIL = "kysely.signup@gmail.com";

const createSchemaCheckDatabase = async () => {
  const pg = await PGlite.create("memory://");
  try {
    await migrate(drizzle({ client: pg }), {
      migrationsFolder: resolve(process.cwd(), "drizzle"),
    });
  } catch (error) {
    await pg.close();
    throw error;
  }
  return {
    db: new Kysely<DB>({ dialect: new PGliteDialect(pg) }),
    close: () => pg.close(),
  };
};

it("blocks suspended profile changes but allows password changes and active updates", async () => {
  const db = await createE2EKysely();
  const auth = makeAuth({
    db,
    sendVerificationOTP: () => Promise.resolve(),
  });
  const email = "issue17.suspended@gmail.com";
  await auth.api.signUpEmail({
    body: {
      email,
      name: "Before Suspension",
      password: "Harbor-Lantern-2026!",
    },
  });
  const user = await db
    .selectFrom("user")
    .select("id")
    .where("email", "=", email)
    .executeTakeFirstOrThrow();

  await db
    .updateTable("user")
    .set({ emailVerified: true })
    .where("id", "=", user.id)
    .executeTakeFirstOrThrow();
  const signInResponse = await auth.handler(
    new Request(`${envServer.VITE_BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: envServer.VITE_BASE_URL,
      },
      body: JSON.stringify({ email, password: "Harbor-Lantern-2026!" }),
    }),
  );
  const cookie = signInResponse.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";", 1)[0])
    .join("; ");
  expect(signInResponse.status).toBe(200);
  expect(cookie).toContain("session_token=");
  const session = await auth.api.getSession({
    headers: new Headers({ cookie }),
  });
  expect(session?.user.email).toBe(email);
  expect(session?.user.suspendedAt).toBeNull();
  await db
    .updateTable("user")
    .set({
      suspendedAt: new Date(),
      suspendedReason: "Profile abuse",
    })
    .where("id", "=", user.id)
    .executeTakeFirstOrThrow();

  await expect(
    auth.api.updateUser({
      body: { name: "After Suspension" },
      headers: new Headers({ cookie }),
    }),
  ).rejects.toMatchObject({
    message: "Your account is suspended and profile changes are disabled.",
    statusCode: 403,
  });

  const storedUser = await db
    .selectFrom("user")
    .select("name")
    .where("id", "=", user.id)
    .executeTakeFirstOrThrow();
  expect(storedUser.name).toBe("Before Suspension");

  await auth.api.changePassword({
    body: {
      currentPassword: "Harbor-Lantern-2026!",
      newPassword: "Canyon-Galaxy-2027!",
    },
    headers: new Headers({ cookie }),
  });
  const passwordSignInResponse = await auth.handler(
    new Request(`${envServer.VITE_BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: envServer.VITE_BASE_URL,
      },
      body: JSON.stringify({
        email,
        password: "Canyon-Galaxy-2027!",
      }),
    }),
  );
  expect(passwordSignInResponse.status).toBe(200);

  await db
    .updateTable("user")
    .set({ suspendedAt: null, suspendedReason: null })
    .where("id", "=", user.id)
    .executeTakeFirstOrThrow();
  await auth.api.updateUser({
    body: { name: "After Restoration" },
    headers: new Headers({ cookie }),
  });

  const restoredUser = await db
    .selectFrom("user")
    .select("name")
    .where("id", "=", user.id)
    .executeTakeFirstOrThrow();
  expect(restoredUser.name).toBe("After Restoration");
});

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

it("validates the Kysely schema during auth initialization and reports missing tables", async () => {
  const { db, close } = await createSchemaCheckDatabase();
  try {
    const cleanLogs: { level: string; message: string }[] = [];
    const auth = makeAuth({
      db,
      logger: {
        log: (level, message) => {
          cleanLogs.push({ level, message });
        },
      },
      sendVerificationOTP: () => Promise.resolve(),
    });
    const context = await auth.$context;
    const checkSchema = context.checkSchema;
    expect(checkSchema).toBeDefined();
    if (!checkSchema) throw new Error("Schema check is unavailable");
    await checkSchema();
    expect(cleanLogs.filter(({ level }) => level === "error")).toEqual([]);

    await db.schema.dropTable("verification").execute();
    const missingTableLogs: { level: string; message: string }[] = [];
    const authWithMissingTable = makeAuth({
      db,
      logger: {
        log: (level, message) => {
          missingTableLogs.push({ level, message });
        },
      },
      sendVerificationOTP: () => Promise.resolve(),
    });
    const missingTableContext = await authWithMissingTable.$context;
    const checkMissingTableSchema = missingTableContext.checkSchema;
    expect(checkMissingTableSchema).toBeDefined();
    if (!checkMissingTableSchema) {
      throw new Error("Schema check is unavailable");
    }
    await expect(checkMissingTableSchema()).rejects.toThrow("verification");
    expect(
      missingTableLogs.some(
        ({ level, message }) =>
          level === "error" && message.includes("verification"),
      ),
    ).toBe(true);
  } finally {
    await close();
  }
});
