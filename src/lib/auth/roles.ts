import { Schema } from "effect";

/**
 * The user ranks, from the lowest to the highest authority.
 *
 * The rank is stored on `user.role` and derived from community activity
 * (points ledger) plus staff decisions; see the permission/points plan.
 * Authorization decides through permissions in `src/lib/auth/policy.ts`,
 * never by comparing these labels.
 */
export const RoleSchema = Schema.Literals([
  "novice",
  "uploader",
  "moderator",
  "admin",
]);

export type Role = typeof RoleSchema.Type;

/**
 * Client-safe rank decoder for loosely-typed user objects (session payloads
 * cross the wire without plugin field typings). Anything missing or
 * unrecognized falls back to `"novice"` for display only; authorization
 * refuses such accounts instead (`SessionService.requireActor`).
 */
export const roleOf = (
  user: { readonly id?: unknown; readonly role?: unknown } | null | undefined,
): Role => {
  // SAFETY: every session user carries a `role` key at runtime through the
  // Better Auth additionalFields config (`src/lib/auth/index.ts`); this cast
  // only restates that invariant so the value can be schema-checked below.
  const candidate: unknown = (user as { readonly role?: unknown } | null)?.role;
  return Schema.is(RoleSchema)(candidate) ? candidate : "novice";
};
