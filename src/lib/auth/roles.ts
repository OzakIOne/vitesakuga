import { Schema } from "effect";

/**
 * The user ranks, from the lowest to the highest authority.
 *
 * The rank is stored on `user.role` and derived from community activity
 * (points ledger) plus staff decisions; see the permission/points plan.
 * Authorization code must never compare roles directly against `"admin"`
 * strings — use the helpers below so the hierarchy stays in one place.
 */
export const RoleSchema = Schema.Literals([
  "novice",
  "uploader",
  "moderator",
  "admin",
]);

export type Role = typeof RoleSchema.Type;

/** Ordered low → high; the index is each role's authority rank. */
const ROLE_HIERARCHY: ReadonlyArray<Role> = [
  "novice",
  "uploader",
  "moderator",
  "admin",
];

/** Lowest role that grants staff privileges over other users' content. */
export const STAFF_ROLE_FLOOR = "moderator" satisfies Role;

const roleRank = (role: Role): number => ROLE_HIERARCHY.indexOf(role);

/** True when `role` sits at or above `floor` in the hierarchy. */
export const roleAtLeast = (role: Role, floor: Role): boolean =>
  roleRank(role) >= roleRank(floor);

/** True when the role counts as staff (moderator or admin). */
export const isStaffRole = (role: Role): boolean =>
  roleAtLeast(role, STAFF_ROLE_FLOOR);

/**
 * Client-safe rank decoder for loosely-typed user objects (session payloads
 * cross the wire without plugin field typings). Anything missing or
 * unrecognized fails closed to `"novice"` — the same contract as the
 * server-side `getUserRole`.
 */
export const roleOf = (
  user: { readonly id?: unknown } | null | undefined,
): Role => {
  // SAFETY: every session user carries a `role` key at runtime through the
  // Better Auth additionalFields config (`src/lib/auth/index.ts`); this cast
  // only restates that invariant so the value can be schema-checked below.
  const candidate: unknown = (user as { readonly role?: unknown } | null)?.role;
  return Schema.is(RoleSchema)(candidate) ? candidate : "novice";
};
