import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createSchemaFactory } from "drizzle-zod";

export const { createInsertSchema, createSelectSchema } = createSchemaFactory({
  coerce: true,
});

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

export const userSelectSchema = createSelectSchema(user);
export const userInsertSchema = createInsertSchema(user);

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

export const account = pgTable("account", {
  accessToken: text(),
  accessTokenExpiresAt: timestamp(),
  accountId: text().notNull(),
  createdAt: timestamp().notNull(),
  id: text().primaryKey(),
  idToken: text(),
  password: text(),
  providerId: text().notNull(),
  refreshToken: text(),
  refreshTokenExpiresAt: timestamp(),
  scope: text(),
  updatedAt: timestamp().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const verification = pgTable("verification", {
  createdAt: timestamp().$defaultFn(() => /* @__PURE__ */ new Date()),
  expiresAt: timestamp().notNull(),
  id: text().primaryKey(),
  identifier: text().notNull(),
  updatedAt: timestamp().$defaultFn(() => /* @__PURE__ */ new Date()),
  value: text().notNull(),
});
