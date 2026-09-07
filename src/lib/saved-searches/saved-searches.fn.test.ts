import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeAuthSession } from "../auth/session.fixture";
import type { DB } from "../db/kysely";
import {
  makeServiceTestLayer,
  type ServiceTestContext,
} from "../db/test-utils";
import {
  SavedSearchesService,
  SavedSearchesServiceLive,
} from "./saved-searches.service";

let db: Kysely<DB>;
let runEffect: ServiceTestContext<SavedSearchesService>["runEffect"];
let runFailure: ServiceTestContext<SavedSearchesService>["runFailure"];
let mockGetSession: ReturnType<typeof vi.fn>;
let closeCtx: () => Promise<void>;

const testUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@test.com",
  image: null,
  username: "alice",
};

const otherUser = {
  id: "user-2",
  name: "Bob",
  email: "bob@test.com",
  image: null,
  username: "bob",
};

const search = {
  dateRange: "week" as const,
  name: "Recent action",
  q: "sakuga width:>1000",
  sortBy: "oldest" as const,
  tags: ["action", "key animation"],
};

beforeEach(async () => {
  const ctx = await makeServiceTestLayer(SavedSearchesServiceLive);
  db = ctx.db;
  runEffect = ctx.runEffect;
  runFailure = ctx.runFailure;
  mockGetSession = ctx.mockGetSession;
  closeCtx = ctx.close;

  await db.insertInto("user").values(testUser).execute();
  await db.insertInto("user").values(otherUser).execute();
  await db.deleteFrom("saved_searches").execute();
});

afterEach(() => closeCtx());

describe(SavedSearchesService.save, () => {
  it("saves the current search for the authenticated user", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(SavedSearchesService.save(search));

    expect(result).toMatchObject({
      date_range: "week",
      name: "Recent action",
      q: "sakuga width:>1000",
      sort_by: "oldest",
      tags: ["action", "key animation"],
    });

    const rows = await db
      .selectFrom("saved_searches")
      .selectAll()
      .where("user_id", "=", testUser.id)
      .execute();
    expect(rows).toHaveLength(1);
  });

  it("rejects anonymous users", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const error = await runFailure(SavedSearchesService.save(search));

    expect(error).toMatchObject({
      _tag: "UnauthorizedError",
      message: "You must be logged in",
    });
  });

  it("rejects a duplicate name for the same user", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));
    await runEffect(SavedSearchesService.save(search));
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const error = await runFailure(SavedSearchesService.save(search));

    expect(error).toMatchObject({
      _tag: "ValidationError",
      message: "A saved search with this name already exists",
    });
  });
});

describe(SavedSearchesService.list, () => {
  it("lists only the current user's saved searches", async () => {
    await db
      .insertInto("saved_searches")
      .values({
        date_range: "all",
        name: "Mine",
        q: "mine",
        sort_by: "newest",
        tags: [],
        user_id: testUser.id,
      })
      .execute();
    await db
      .insertInto("saved_searches")
      .values({
        date_range: "all",
        name: "Not mine",
        q: "secret",
        sort_by: "newest",
        tags: [],
        user_id: otherUser.id,
      })
      .execute();
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    const result = await runEffect(SavedSearchesService.list());

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Mine");
    expect(result[0]?.created_at).toMatch(/T/);
  });
});

describe(SavedSearchesService.delete_, () => {
  it("deletes a saved search owned by the current user", async () => {
    const row = await db
      .insertInto("saved_searches")
      .values({
        date_range: "all",
        name: "To delete",
        q: "",
        sort_by: "newest",
        tags: [],
        user_id: testUser.id,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    await expect(
      runEffect(SavedSearchesService.delete_(row.id)),
    ).resolves.toEqual({ success: true });

    const remaining = await db
      .selectFrom("saved_searches")
      .selectAll()
      .execute();
    expect(remaining).toHaveLength(0);
  });

  it("cannot delete another user's saved search", async () => {
    const row = await db
      .insertInto("saved_searches")
      .values({
        date_range: "all",
        name: "Protected",
        q: "",
        sort_by: "newest",
        tags: [],
        user_id: otherUser.id,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    mockGetSession.mockResolvedValueOnce(makeAuthSession(testUser));

    await runEffect(SavedSearchesService.delete_(row.id));

    const remaining = await db
      .selectFrom("saved_searches")
      .selectAll()
      .execute();
    expect(remaining).toHaveLength(1);
  });
});
