import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";

import { ForbiddenError } from "../errors";
import {
  authorize,
  authorizeOwned,
  roleHasPermission,
  type Permission,
} from "./policy";
import type { Role } from "./roles";

const EVERY_PERMISSION: ReadonlyArray<Permission> = [
  "comments:delete-any",
  "comments:delete-own",
  "comments:edit-any",
  "comments:edit-own",
  "edits:approve",
  "moderation:view",
  "playlists:edit-own",
  "posts:create",
  "posts:delete-any",
  "posts:delete-own",
  "posts:edit-any",
  "posts:edit-own",
  "posts:suggest-edit",
  "promotions:review",
  "roles:assign",
  "storage:maintain",
  "videos:replace-any",
  "videos:replace-own",
];

const GRANTS_BY_ROLE: ReadonlyArray<{
  readonly role: Role;
  readonly granted: ReadonlyArray<Permission>;
}> = [
  {
    role: "novice",
    granted: [
      "comments:delete-own",
      "comments:edit-own",
      "playlists:edit-own",
      "posts:create",
      "posts:delete-own",
      "posts:edit-own",
      "videos:replace-own",
    ],
  },
  {
    role: "uploader",
    granted: [
      "comments:delete-own",
      "comments:edit-own",
      "playlists:edit-own",
      "posts:create",
      "posts:delete-own",
      "posts:edit-own",
      "posts:suggest-edit",
      "videos:replace-own",
    ],
  },
  {
    role: "moderator",
    granted: [
      "comments:delete-any",
      "comments:delete-own",
      "comments:edit-any",
      "comments:edit-own",
      "edits:approve",
      "moderation:view",
      "playlists:edit-own",
      "posts:create",
      "posts:delete-any",
      "posts:delete-own",
      "posts:edit-any",
      "posts:edit-own",
      "posts:suggest-edit",
      "promotions:review",
      "videos:replace-any",
      "videos:replace-own",
    ],
  },
  {
    role: "admin",
    granted: [
      "comments:delete-any",
      "comments:delete-own",
      "comments:edit-any",
      "comments:edit-own",
      "edits:approve",
      "moderation:view",
      "playlists:edit-own",
      "posts:create",
      "posts:delete-any",
      "posts:delete-own",
      "posts:edit-any",
      "posts:edit-own",
      "posts:suggest-edit",
      "promotions:review",
      "roles:assign",
      "storage:maintain",
      "videos:replace-any",
      "videos:replace-own",
    ],
  },
];

describe("role grants", () => {
  it.each(GRANTS_BY_ROLE)(
    "grants $role exactly its permissions",
    ({ role, granted }) => {
      const actual = EVERY_PERMISSION.filter((permission) =>
        roleHasPermission(role, permission),
      );
      expect([...actual].sort()).toEqual([...granted].sort());
    },
  );
});

const novice = { id: "novice-1", role: "novice" } as const;
const moderator = { id: "moderator-1", role: "moderator" } as const;

describe("authorize", () => {
  it("fails with the caller's message when the role lacks the permission", async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        authorize({
          actor: novice,
          permission: "roles:assign",
          forbiddenMessage: "Only admins can assign roles.",
        }),
      ),
    );
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.message).toBe("Only admins can assign roles.");
  });

  it("succeeds when the role grants the permission", async () => {
    await expect(
      Effect.runPromise(
        authorize({ actor: moderator, permission: "moderation:view" }),
      ),
    ).resolves.toBeUndefined();
  });
});

type OwnedRow = { readonly ownerId: string };

const ownedBy = (ownerId: string): Option.Option<OwnedRow> =>
  Option.some({ ownerId });

const guardOwned = (args: {
  readonly actor: { readonly id: string; readonly role: Role };
  readonly resource: Option.Option<OwnedRow>;
  readonly any?: Permission;
}) =>
  authorizeOwned({
    actor: args.actor,
    resource: args.resource,
    selectOwnerId: (row) => row.ownerId,
    own: "posts:edit-own",
    any: args.any,
    notFound: Effect.fail("missing" as const),
    forbidden: Effect.fail("forbidden" as const),
  });

describe("authorizeOwned", () => {
  it("returns the row to its owner when the own permission holds", async () => {
    const row = await Effect.runPromise(
      guardOwned({ actor: novice, resource: ownedBy("novice-1") }),
    );
    expect(row).toEqual({ ownerId: "novice-1" });
  });

  it("fails with notFound when the row is absent", async () => {
    const error = await Effect.runPromise(
      Effect.flip(guardOwned({ actor: moderator, resource: Option.none() })),
    );
    expect(error).toBe("missing");
  });

  it("refuses another user's row without the any permission", async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        guardOwned({
          actor: novice,
          resource: ownedBy("someone-else"),
          any: "posts:edit-any",
        }),
      ),
    );
    expect(error).toBe("forbidden");
  });

  it("grants another user's row when the any permission holds", async () => {
    const row = await Effect.runPromise(
      guardOwned({
        actor: moderator,
        resource: ownedBy("someone-else"),
        any: "posts:edit-any",
      }),
    );
    expect(row).toEqual({ ownerId: "someone-else" });
  });

  it("refuses another user's row when no any permission is given", async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        guardOwned({ actor: moderator, resource: ownedBy("someone-else") }),
      ),
    );
    expect(error).toBe("forbidden");
  });
});
