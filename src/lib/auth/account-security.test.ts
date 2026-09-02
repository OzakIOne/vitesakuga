import type { Kysely } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
import {
  AccountSecurityService,
  AccountSecurityServiceLive,
} from "./account-security";

let db: Kysely<DB>;
let runEffect: ReturnType<typeof makeServiceTestLayer>["runEffect"];
let mockGetSession: ReturnType<typeof vi.fn>;

const testUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@test.com",
  image: null,
  username: "alice",
};

const insertAccount = (
  overrides: Partial<{
    password: string | null;
    providerId: string;
    userId: string;
  }> = {},
) =>
  db
    .insertInto("account")
    .values({
      id: `account-${overrides.providerId ?? "credential"}`,
      accountId: overrides.userId ?? testUser.id,
      userId: overrides.userId ?? testUser.id,
      providerId: overrides.providerId ?? "credential",
      issuer: "local:credential",
      password: overrides.password ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .execute();

beforeEach(async () => {
  const ctx = await makeServiceTestLayer(AccountSecurityServiceLive);
  db = ctx.db;
  runEffect = ctx.runEffect;
  mockGetSession = ctx.mockGetSession;

  await db.insertInto("user").values(testUser).execute();
});

describe(AccountSecurityService.getHasPassword, () => {
  it("returns hasPassword true when a credential account has a password", async () => {
    await insertAccount({ password: "hashed-password" });
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    await expect(
      runEffect(AccountSecurityService.getHasPassword()),
    ).resolves.toEqual({ hasPassword: true });
  });

  it("returns hasPassword false for OAuth-only users", async () => {
    await insertAccount({ password: null, providerId: "github" });
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    await expect(
      runEffect(AccountSecurityService.getHasPassword()),
    ).resolves.toEqual({ hasPassword: false });
  });

  it("returns hasPassword false when no account rows exist", async () => {
    mockGetSession.mockResolvedValueOnce({ user: testUser });

    await expect(
      runEffect(AccountSecurityService.getHasPassword()),
    ).resolves.toEqual({ hasPassword: false });
  });

  it("throws unauthorized when not logged in", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(
      runEffect(AccountSecurityService.getHasPassword()),
    ).rejects.toThrow("You must be logged in");
  });
});
