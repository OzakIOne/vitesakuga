import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "../db/kysely";
import {
  makeServiceTestLayer,
  type ServiceTestContext,
} from "../db/test-utils";
import {
  AccountSecurityService,
  AccountSecurityServiceLive,
} from "./account-security";
import { makeAuthSession } from "./session.fixture";

let db: Kysely<DB>;
let runEffect: ServiceTestContext["runEffect"];
let runFailure: ServiceTestContext["runFailure"];
let mockGetSession: ReturnType<typeof vi.fn>;
let closeCtx: () => Promise<void>;

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
  runFailure = ctx.runFailure;
  mockGetSession = ctx.mockGetSession;
  closeCtx = ctx.close;

  await db.insertInto("user").values(testUser).execute();
});

afterEach(() => closeCtx());

describe(AccountSecurityService.getHasPassword, () => {
  it("returns hasPassword true when a credential account has a password", async () => {
    await insertAccount({ password: "hashed-password" });
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    await expect(
      runEffect(AccountSecurityService.getHasPassword()),
    ).resolves.toEqual({ hasPassword: true });
  });

  it("returns hasPassword false for OAuth-only users", async () => {
    await insertAccount({ password: null, providerId: "github" });
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    await expect(
      runEffect(AccountSecurityService.getHasPassword()),
    ).resolves.toEqual({ hasPassword: false });
  });

  it("returns hasPassword false when no account rows exist", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    await expect(
      runEffect(AccountSecurityService.getHasPassword()),
    ).resolves.toEqual({ hasPassword: false });
  });

  it("throws unauthorized when not logged in", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const error = await runFailure(AccountSecurityService.getHasPassword());
    expect(error).toMatchObject({
      _tag: "UnauthorizedError",
      message: "You must be logged in",
    });
  });
});
