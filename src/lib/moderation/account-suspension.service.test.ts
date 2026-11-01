import { Effect, Layer } from "effect";
import type { Kysely } from "kysely";
import { describe, expect, it, type Mock } from "vitest";

import type { AuthSessionProvider } from "../auth/context";
import { makeAuthSession } from "../auth/session.fixture";
import {
  CommentsService,
  CommentsServiceLive,
} from "../comments/comments.service";
import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
import { asPostId } from "../ids";
import { ModerationService, ModerationServiceLive } from "./moderation.service";

type Role = "novice" | "uploader" | "moderator" | "admin";

const SERVICES_LIVE = Layer.mergeAll(
  ModerationServiceLive,
  CommentsServiceLive,
);

const insertUser = (
  db: Kysely<DB>,
  args: {
    readonly id: string;
    readonly role: Role;
    readonly suspendedReason?: string;
  },
) =>
  db
    .insertInto("user")
    .values({
      email: `${args.id}@test.com`,
      id: args.id,
      name: args.id,
      role: args.role,
      suspendedAt: args.suspendedReason === undefined ? null : new Date(),
      suspendedReason: args.suspendedReason ?? null,
      username: args.id,
    })
    .execute();

const insertPost = (db: Kysely<DB>, ownerId: string) =>
  db
    .insertInto("posts")
    .values({
      description: "description",
      id: 1,
      thumbnailKey: "thumb.jpg",
      title: "Title",
      userId: ownerId,
      videoKey: null,
      videoMetadata: "{}",
    })
    .execute();

/** Each request reads the account row, as Better Auth does with the cookie cache disabled. */
const signInAsFreshAccount = (
  db: Kysely<DB>,
  mockGetSession: Mock<AuthSessionProvider["api"]["getSession"]>,
  accountId: string,
) =>
  mockGetSession.mockImplementation(async () => {
    const row = await db
      .selectFrom("user")
      .selectAll()
      .where("id", "=", accountId)
      .executeTakeFirstOrThrow();
    return makeAuthSession({
      id: row.id,
      role: row.role,
      suspendedAt: row.suspendedAt,
      suspendedReason: row.suspendedReason,
      username: row.username,
    });
  });

const suspend = (args: { readonly reason: string; readonly userId: string }) =>
  Effect.flatMap(ModerationService, (service) => service.suspendUser(args));

const restore = (args: { readonly userId: string }) =>
  Effect.flatMap(ModerationService, (service) => service.unsuspendUser(args));

type RuleRow = {
  readonly name: string;
  readonly users: ReadonlyArray<{
    readonly id: string;
    readonly role: Role;
    readonly suspendedReason?: string;
  }>;
  readonly actor: {
    readonly id: string;
    readonly role: Role;
    readonly suspended?: true;
  };
  readonly userId: string;
  readonly reason?: string;
  /** `ok` or the tag of the error the suspension must fail with. */
  readonly outcome:
    | "ok"
    | "AccountSuspendedError"
    | "ForbiddenError"
    | "LastAdminError"
    | "UserNotFoundError"
    | "ValidationError";
};

const RULES: ReadonlyArray<RuleRow> = [
  {
    name: "a moderator suspends a novice",
    users: [
      { id: "mod", role: "moderator" },
      { id: "nov", role: "novice" },
    ],
    actor: { id: "mod", role: "moderator" },
    userId: "nov",
    reason: "Spam",
    outcome: "ok",
  },
  {
    name: "an admin suspends a moderator",
    users: [
      { id: "adm", role: "admin" },
      { id: "mod", role: "moderator" },
    ],
    actor: { id: "adm", role: "admin" },
    userId: "mod",
    reason: "Abuse",
    outcome: "ok",
  },
  {
    name: "an admin suspends another admin while one admin stays active",
    users: [
      { id: "adm-1", role: "admin" },
      { id: "adm-2", role: "admin" },
    ],
    actor: { id: "adm-1", role: "admin" },
    userId: "adm-2",
    reason: "Leaked credentials",
    outcome: "ok",
  },
  {
    name: "a moderator cannot suspend another moderator",
    users: [
      { id: "mod-1", role: "moderator" },
      { id: "mod-2", role: "moderator" },
    ],
    actor: { id: "mod-1", role: "moderator" },
    userId: "mod-2",
    reason: "Spam",
    outcome: "ForbiddenError",
  },
  {
    name: "a moderator cannot suspend an admin",
    users: [
      { id: "mod", role: "moderator" },
      { id: "adm", role: "admin" },
    ],
    actor: { id: "mod", role: "moderator" },
    userId: "adm",
    reason: "Spam",
    outcome: "ForbiddenError",
  },
  {
    name: "a novice cannot suspend anyone",
    users: [
      { id: "nov-1", role: "novice" },
      { id: "nov-2", role: "novice" },
    ],
    actor: { id: "nov-1", role: "novice" },
    userId: "nov-2",
    reason: "Spam",
    outcome: "ForbiddenError",
  },
  {
    name: "a suspended moderator cannot suspend",
    users: [
      { id: "mod", role: "moderator" },
      { id: "nov", role: "novice" },
    ],
    actor: { id: "mod", role: "moderator", suspended: true },
    userId: "nov",
    reason: "Spam",
    outcome: "AccountSuspendedError",
  },
  {
    name: "nobody suspends their own account",
    users: [{ id: "mod", role: "moderator" }],
    actor: { id: "mod", role: "moderator" },
    userId: "mod",
    reason: "Spam",
    outcome: "ValidationError",
  },
  {
    name: "a suspension needs a reason",
    users: [
      { id: "mod", role: "moderator" },
      { id: "nov", role: "novice" },
    ],
    actor: { id: "mod", role: "moderator" },
    userId: "nov",
    reason: "   ",
    outcome: "ValidationError",
  },
  {
    name: "an unknown account cannot be suspended",
    users: [{ id: "mod", role: "moderator" }],
    actor: { id: "mod", role: "moderator" },
    userId: "ghost",
    reason: "Spam",
    outcome: "UserNotFoundError",
  },
  {
    name: "an admin cannot suspend the last active admin",
    users: [
      { id: "adm-1", role: "novice" },
      { id: "adm-2", role: "admin" },
    ],
    actor: { id: "adm-1", role: "admin" },
    userId: "adm-2",
    reason: "Spam",
    outcome: "LastAdminError",
  },
];

describe("suspendUser rules", () => {
  it.each(RULES)("$name", async (row) => {
    const ctx = await makeServiceTestLayer(SERVICES_LIVE);
    try {
      for (const user of row.users) {
        await insertUser(ctx.db, user);
      }
      ctx.mockGetSession.mockResolvedValue(
        makeAuthSession({
          id: row.actor.id,
          role: row.actor.role,
          suspendedAt: row.actor.suspended === true ? new Date() : null,
          suspendedReason: row.actor.suspended === true ? "Spam" : null,
          username: row.actor.id,
        }),
      );
      const operation = suspend({
        reason: row.reason ?? "Spam",
        userId: row.userId,
      });
      if (row.outcome === "ok") {
        await ctx.runEffect(operation);
        const target = await ctx.db
          .selectFrom("user")
          .select(["suspendedAt", "suspendedReason"])
          .where("id", "=", row.userId)
          .executeTakeFirstOrThrow();
        expect(target.suspendedAt).toBeInstanceOf(Date);
        expect(target.suspendedReason).toBe(row.reason);
        return;
      }
      const error = await ctx.runFailure(operation);
      expect(error._tag).toBe(row.outcome);
    } finally {
      await ctx.close();
    }
  });

  it("restores an account and clears its reason", async () => {
    const ctx = await makeServiceTestLayer(SERVICES_LIVE);
    try {
      await insertUser(ctx.db, { id: "mod", role: "moderator" });
      await insertUser(ctx.db, {
        id: "nov",
        role: "novice",
        suspendedReason: "Spam",
      });
      ctx.mockGetSession.mockResolvedValue(
        makeAuthSession({ id: "mod", role: "moderator", username: "mod" }),
      );
      await ctx.runEffect(restore({ userId: "nov" }));
      const target = await ctx.db
        .selectFrom("user")
        .select(["suspendedAt", "suspendedReason"])
        .where("id", "=", "nov")
        .executeTakeFirstOrThrow();
      expect(target.suspendedAt).toBeNull();
      expect(target.suspendedReason).toBeNull();
    } finally {
      await ctx.close();
    }
  });

  it("refuses a moderator lifting an admin's suspension", async () => {
    const ctx = await makeServiceTestLayer(SERVICES_LIVE);
    try {
      await insertUser(ctx.db, { id: "mod", role: "moderator" });
      await insertUser(ctx.db, {
        id: "adm",
        role: "admin",
        suspendedReason: "Spam",
      });
      ctx.mockGetSession.mockResolvedValue(
        makeAuthSession({ id: "mod", role: "moderator", username: "mod" }),
      );
      const error = await ctx.runFailure(restore({ userId: "adm" }));
      expect(error._tag).toBe("ForbiddenError");
    } finally {
      await ctx.close();
    }
  });

  it("keeps the original reason when a suspended account is suspended again", async () => {
    const ctx = await makeServiceTestLayer(SERVICES_LIVE);
    try {
      await insertUser(ctx.db, { id: "mod", role: "moderator" });
      await insertUser(ctx.db, {
        id: "nov",
        role: "novice",
        suspendedReason: "Spam",
      });
      ctx.mockGetSession.mockResolvedValue(
        makeAuthSession({ id: "mod", role: "moderator", username: "mod" }),
      );
      await ctx.runEffect(suspend({ reason: "Other", userId: "nov" }));
      const target = await ctx.db
        .selectFrom("user")
        .select("suspendedReason")
        .where("id", "=", "nov")
        .executeTakeFirstOrThrow();
      expect(target.suspendedReason).toBe("Spam");
    } finally {
      await ctx.close();
    }
  });

  it("applies a suspension to the account's next mutation and lifts it on restore", async () => {
    const ctx = await makeServiceTestLayer(SERVICES_LIVE);
    try {
      await insertUser(ctx.db, { id: "mod", role: "moderator" });
      await insertUser(ctx.db, { id: "nov", role: "novice" });
      await insertPost(ctx.db, "mod");
      const comment = () =>
        Effect.flatMap(CommentsService, (service) =>
          service.add({ content: "Nice!", postId: asPostId(1) }),
        );

      signInAsFreshAccount(ctx.db, ctx.mockGetSession, "nov");
      await ctx.runEffect(comment());

      signInAsFreshAccount(ctx.db, ctx.mockGetSession, "mod");
      await ctx.runEffect(suspend({ reason: "Spam", userId: "nov" }));

      signInAsFreshAccount(ctx.db, ctx.mockGetSession, "nov");
      const refused = await ctx.runFailure(comment());
      expect(refused).toMatchObject({
        _tag: "AccountSuspendedError",
        reason: "Spam",
      });
      const visible = await ctx.runEffect(
        Effect.flatMap(CommentsService, (service) => service.fetch(1)),
      );
      expect(visible).toHaveLength(1);

      signInAsFreshAccount(ctx.db, ctx.mockGetSession, "mod");
      await ctx.runEffect(restore({ userId: "nov" }));

      signInAsFreshAccount(ctx.db, ctx.mockGetSession, "nov");
      await ctx.runEffect(comment());
    } finally {
      await ctx.close();
    }
  });
});
