import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { Schema } from "effect";

export const user = pgTable("user", {
  createdAt: timestamp()
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean()
    .$defaultFn(() => false)
    .notNull(),
  id: text().primaryKey(),
  image: text(),
  name: text().notNull(),
  updatedAt: timestamp()
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const userSelectSchema = Schema.Struct({
  createdAt: Schema.Date,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  id: Schema.String,
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
  updatedAt: Schema.Date,
});

export const userInsertSchema = Schema.Struct({
  createdAt: Schema.optionalKey(Schema.Date),
  email: Schema.String,
  emailVerified: Schema.optionalKey(Schema.Boolean),
  id: Schema.String,
  image: Schema.optionalKey(Schema.NullOr(Schema.String)),
  name: Schema.String,
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
