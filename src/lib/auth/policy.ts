import { DateTime, Effect, Option } from "effect";

import {
  ForbiddenError,
  ReauthenticationRequiredError,
  UnauthorizedError,
} from "../errors";
import type { Permission } from "./capabilities";
import type { Role } from "./roles";
import type { AuthorizedActor, SessionFetchError } from "./session.effect";

/** Every failure a signed-in authorization check can produce. */
export type PolicyError =
  | ForbiddenError
  | ReauthenticationRequiredError
  | SessionFetchError
  | UnauthorizedError;

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

const NOVICE_PERMISSIONS: ReadonlyArray<Permission> = [
  "comments:delete-own",
  "comments:edit-own",
  "playlists:edit-own",
  "posts:create",
  "posts:delete-own",
  "posts:edit-own",
  "videos:replace-own",
];

const UPLOADER_PERMISSIONS: ReadonlyArray<Permission> = [
  ...NOVICE_PERMISSIONS,
  "posts:suggest-edit",
];

const MODERATOR_PERMISSIONS: ReadonlyArray<Permission> = [
  ...UPLOADER_PERMISSIONS,
  "comments:delete-any",
  "comments:edit-any",
  "edits:approve",
  "moderation:view",
  "posts:delete-any",
  "posts:edit-any",
  "promotions:review",
  "users:suspend",
  "videos:replace-any",
];

const ADMIN_PERMISSIONS: ReadonlyArray<Permission> = [
  ...MODERATOR_PERMISSIONS,
  "audit:view",
  "roles:assign",
  "storage:maintain",
  "users:suspend-staff",
];

/**
 * Permissions granted by each role. Each role lists its full set (no inherited
 * ranks), so changing one role never silently changes another. Authorization
 * code checks these permissions, never the role labels themselves.
 */
const PERMISSIONS_BY_ROLE = {
  admin: ADMIN_PERMISSIONS,
  moderator: MODERATOR_PERMISSIONS,
  novice: NOVICE_PERMISSIONS,
  uploader: UPLOADER_PERMISSIONS,
} as const satisfies Record<Role, ReadonlyArray<Permission>>;

export const permissionsForRole = (role: Role): ReadonlyArray<Permission> =>
  PERMISSIONS_BY_ROLE[role];

/** Pure permission lookup for the server-side authorization policy. */
export const roleHasPermission = (
  role: Role,
  permission: Permission,
): boolean => permissionsForRole(role).includes(permission);

// ---------------------------------------------------------------------------
// Enforcement
// ---------------------------------------------------------------------------

const ADMIN_SESSION_FRESHNESS_WINDOW_MS = 15 * 60 * 1_000;
const DEFAULT_FORBIDDEN_MESSAGE =
  "You do not have permission to perform this action.";

/**
 * Fails with `ForbiddenError` unless the actor's role grants `permission`.
 * The actor must come from `SessionService.requireActor`, so the role is
 * already validated and the caller is signed in.
 */
export const authorize = Effect.fn("authorize")(function* (input: {
  readonly actor: AuthorizedActor;
  readonly permission: Permission;
  readonly forbiddenMessage?: string | undefined;
}) {
  if (!roleHasPermission(input.actor.role, input.permission)) {
    return yield* new ForbiddenError({
      message: input.forbiddenMessage ?? DEFAULT_FORBIDDEN_MESSAGE,
    });
  }
});

export const requireRecentSignIn = Effect.fn("requireRecentSignIn")(
  function* (input: { readonly actor: AuthorizedActor }) {
    const now = yield* DateTime.now;
    const ageMillis =
      DateTime.toDate(now).getTime() - input.actor.signedInAt.getTime();
    if (
      !Number.isFinite(ageMillis) ||
      ageMillis < 0 ||
      ageMillis > ADMIN_SESSION_FRESHNESS_WINDOW_MS
    ) {
      return yield* new ReauthenticationRequiredError({
        message:
          "Your sign-in is too old for this admin action. Please sign in again.",
      });
    }
  },
);

/**
 * Loads-and-guards a resource the actor may change. Fails with `notFound`
 * when the row is absent. When the actor owns it, the `own` permission must
 * hold; otherwise the `any` permission, when given, grants access to others'
 * rows and everything else fails with `forbidden`. Returns the owned row.
 */
export const authorizeOwned = <A, ENotFound, EForbidden>(input: {
  readonly actor: AuthorizedActor;
  readonly resource: Option.Option<A>;
  readonly selectOwnerId: (row: NoInfer<A>) => string;
  readonly own: Permission;
  readonly any?: Permission | undefined;
  readonly notFound: Effect.Effect<NoInfer<A>, ENotFound>;
  readonly forbidden: Effect.Effect<never, EForbidden>;
}): Effect.Effect<A, ENotFound | EForbidden> =>
  Option.match(input.resource, {
    onNone: () => input.notFound,
    onSome: (row) => {
      const ownsRow = input.selectOwnerId(row) === input.actor.id;
      const granted = ownsRow
        ? roleHasPermission(input.actor.role, input.own)
        : input.any !== undefined &&
          roleHasPermission(input.actor.role, input.any);
      return granted ? Effect.succeed(row) : input.forbidden;
    },
  });
