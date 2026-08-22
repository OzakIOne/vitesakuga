import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { Schema } from "effect";

import { TimestampSchema } from "./timestamp";

export const user = pgTable("user", {
  createdAt: timestamp()
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  // Set when the account has been deleted and anonymized: posts and comments
  // keep referencing this row so they stay public, attributed to
  // DELETED_USER_NAME ("Deleted user").
  deletedAt: timestamp(),
  email: text().notNull().unique(),
  emailVerified: boolean()
    .$defaultFn(() => false)
    .notNull(),
  id: text().primaryKey(),
  image: text(),
  name: text().notNull(),
  twoFactorEnabled: boolean().notNull().default(false),
  updatedAt: timestamp()
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Display name shown for accounts that were deleted and anonymized.
export const DELETED_USER_NAME = "Deleted user";

export const userSelectSchema = Schema.Struct({
  createdAt: TimestampSchema,
  deletedAt: Schema.optionalKey(Schema.NullOr(TimestampSchema)),
  email: Schema.String,
  emailVerified: Schema.Boolean,
  id: Schema.String,
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
  twoFactorEnabled: Schema.optionalKey(Schema.Boolean),
  updatedAt: TimestampSchema,
});

export const userInsertSchema = Schema.Struct({
  createdAt: Schema.optionalKey(Schema.Date),
  deletedAt: Schema.optionalKey(Schema.NullOr(Schema.Date)),
  email: Schema.String,
  emailVerified: Schema.optionalKey(Schema.Boolean),
  id: Schema.String,
  image: Schema.optionalKey(Schema.NullOr(Schema.String)),
  name: Schema.String,
  twoFactorEnabled: Schema.optionalKey(Schema.Boolean),
  updatedAt: Schema.optionalKey(Schema.Date),
});

export const session = pgTable("session", {
  createdAt: timestamp().notNull(),
  expiresAt: timestamp().notNull(),
  id: text().primaryKey(),
  ipAddress: text(),
  token: text().notNull().unique(),
  updatedAt: timestamp().notNull(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable(
  "account",
  {
    accessToken: text(),
    accessTokenExpiresAt: timestamp(),
    accountId: text().notNull(),
    createdAt: timestamp().notNull(),
    id: text().primaryKey(),
    idToken: text(),
    issuer: text().notNull().default("local:credential"),
    password: text(),
    providerId: text().notNull(),
    refreshToken: text(),
    refreshTokenExpiresAt: timestamp(),
    scope: text(),
    updatedAt: timestamp().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("account_issuer_accountId_unique").on(t.issuer, t.accountId),
  ],
);

export const verification = pgTable("verification", {
  createdAt: timestamp().$defaultFn(() => /* @__PURE__ */ new Date()),
  expiresAt: timestamp().notNull(),
  id: text().primaryKey(),
  identifier: text().notNull(),
  updatedAt: timestamp().$defaultFn(() => /* @__PURE__ */ new Date()),
  value: text().notNull(),
});

export const passkey = pgTable(
  "passkey",
  {
    aaguid: text(),
    backedUp: boolean().notNull(),
    counter: integer().notNull(),
    createdAt: timestamp().$defaultFn(() => /* @__PURE__ */ new Date()),
    credentialID: text().notNull(),
    deviceType: text().notNull(),
    id: text().primaryKey(),
    name: text(),
    publicKey: text().notNull(),
    transports: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("passkey_credentialID_unique").on(t.credentialID),
    index("passkey_userId_idx").on(t.userId),
  ],
);

export const twoFactor = pgTable(
  "twoFactor",
  {
    backupCodes: text().notNull(),
    failedVerificationCount: integer().notNull().default(0),
    id: text().primaryKey(),
    lockedUntil: timestamp(),
    secret: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean().notNull().default(true),
  },
  (t) => [
    index("twoFactor_secret_idx").on(t.secret),
    index("twoFactor_userId_idx").on(t.userId),
  ],
);

// Better Auth rate limiting store (rateLimit.storage = "database").
// Row per (key, path) pair: `key` is the rate-limit key (IP/path), `count` is
// the rolling request counter, `lastRequest` the last-hit epoch ms. Written
// atomically by Better Auth's rate limiter.
export const rateLimit = pgTable(
  "rateLimit",
  {
    id: text().primaryKey(),
    key: text().notNull(),
    count: integer().notNull(),
    lastRequest: bigint({ mode: "number" }).notNull(),
  },
  (t) => [index("rateLimit_key_idx").on(t.key)],
);
