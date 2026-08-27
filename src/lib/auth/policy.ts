import { Effect } from "effect";

import { ForbiddenError, UnauthorizedError } from "../errors";
import { roleAtLeast, roleOf, type Role } from "./roles";
import {
  SessionFetchError,
  SessionService,
  type SessionUser,
} from "./session.effect";

/** The signed-in user a policy predicate receives. */
type PolicyUser = NonNullable<SessionUser>;

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/**
 * Single source of truth for every permission in the app, as `domain:action`
 * pairs. Adding an entry here widens the `Permission` union at compile time;
 * a typo is a type error, not a silent authorization hole.
 */
const PERMISSION_CONFIG = {
  edits: ["approve"],
  posts: [
    "create",
    "delete-any",
    "delete-own",
    "edit-any",
    "edit-own",
    "suggest-edit",
  ],
  promotions: ["review"],
  videos: ["replace-any", "replace-own"],
} as const;

type PermissionConfig = Record<string, ReadonlyArray<string>>;

type InferPermissions<T extends PermissionConfig> = {
  [K in keyof T]: `${K & string}:${T[K][number]}`;
}[keyof T];

export type Permission = InferPermissions<typeof PERMISSION_CONFIG>;

const NOVICE_PERMISSIONS: ReadonlyArray<Permission> = [
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
  "edits:approve",
  "posts:delete-any",
  "posts:edit-any",
  "promotions:review",
  "videos:replace-any",
];

/**
 * Permissions granted by each rank. The sets are cumulative — every rank
 * includes the permissions of the ranks below it. Keep the mapping in sync
 * with `RoleSchema`: authorization code checks these permissions, never the
 * role labels themselves.
 */
export const PERMISSIONS_BY_ROLE = {
  admin: new Set(MODERATOR_PERMISSIONS),
  moderator: new Set(MODERATOR_PERMISSIONS),
  novice: new Set(NOVICE_PERMISSIONS),
  uploader: new Set(UPLOADER_PERMISSIONS),
} as const satisfies Record<Role, ReadonlySet<Permission>>;

/**
 * Extracts a user's rank. Anything missing or unrecognized fails closed to
 * `"novice"` (decoding lives in `roleOf`, client-safe).
 */
export const getUserRole = (user: PolicyUser): Role => roleOf(user);

/** Pure, synchronous permission lookup for a known role. */
export const userHasPermission = (
  role: Role,
  permission: Permission,
): boolean => PERMISSIONS_BY_ROLE[role].has(permission);

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

/** Every failure a policy can produce on its own. */
export type PolicyError =
  | ForbiddenError
  | SessionFetchError
  | UnauthorizedError;

/**
 * An access policy: succeeds with `void` when access is granted, or fails
 * with a policy error otherwise. Composable via `allPolicies`/`anyPolicies`
 * and attachable to any Effect with `withPolicy` (pipe it last so it runs
 * first and fails fast).
 */
export type Policy<E = never, R = never> = Effect.Effect<
  void,
  PolicyError | E,
  SessionService | R
>;

/**
 * Builds a policy from a predicate over the current signed-in user. Not being
 * signed in and failing the check both surface to the caller: `UnauthorizedError`
 * keeps existing sign-in redirects working, `ForbiddenError` explains denial.
 */
export const policy = <E, R>(
  predicate: (user: PolicyUser) => Effect.Effect<boolean, E, R>,
  options?: { readonly forbiddenMessage?: string | undefined },
): Policy<E, R> =>
  Effect.gen(function* () {
    const sessions = yield* SessionService;
    const user = yield* sessions.requireUser("You must be logged in.");
    const granted = yield* predicate(user);
    if (!granted) {
      return yield* new ForbiddenError({
        message:
          options?.forbiddenMessage ??
          "You do not have permission to perform this action.",
      });
    }
  });

/** Policy that holds when the current user's rank is at least `minRole`. */
export const requireRole = (
  minRole: Role,
  options?: { readonly forbiddenMessage?: string | undefined },
): Policy =>
  policy(
    (user) => Effect.succeed(roleAtLeast(getUserRole(user), minRole)),
    options,
  );

/** Policy that holds when the current user's rank grants `permission`. */
export const requirePermission = (
  permission: Permission,
  options?: { readonly forbiddenMessage?: string | undefined },
): Policy =>
  policy(
    (user) => Effect.succeed(userHasPermission(getUserRole(user), permission)),
    options,
  );

/**
 * Composes policies with AND semantics: all must pass. Policies run in order
 * and short-circuit on the first failure.
 */
export const allPolicies = <E, R>(
  first: Policy<E, R>,
  ...rest: ReadonlyArray<Policy<E, R>>
): Policy<E, R> =>
  Effect.all([first, ...rest], { concurrency: 1, discard: true });

/**
 * Composes policies with OR semantics: at least one must pass. The error is
 * taken from the last policy tried.
 */
export const anyPolicies = <E, R>(
  policies: readonly [Policy<E, R>, ...Array<Policy<E, R>>],
): Policy<E, R> => Effect.firstSuccessOf(policies);

/**
 * Attaches a guard to an Effect: the effect runs only if the policy passes.
 * Pipe it as the last step so the guard evaluates before any expensive work.
 *
 * @example
 * postsService.deletePost(postId).pipe(withPolicy(requirePermission("posts:delete-any")))
 */
export const withPolicy =
  <E, R>(guard: Policy<E, R>) =>
  <A, E2, R2>(
    self: Effect.Effect<A, E2, R2>,
  ): Effect.Effect<A, PolicyError | E | E2, SessionService | R | R2> =>
    guard.pipe(Effect.andThen(() => self));
