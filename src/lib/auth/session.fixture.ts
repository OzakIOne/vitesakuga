// oxlint-disable effecttsgo/global-date -- test fixtures must mirror Better Auth's Date-typed session/user rows
import type { Session } from "better-auth";

import type { AuthSession, AuthenticatedUser } from "./session.effect";

/**
 * The real `AuthenticatedUser` plus the `role` label: the admin plugin stores
 * it on the user row and `roleOf` reads it back dynamically, but the stock
 * Better Auth `UserWithTwoFactor` type does not surface it. The wider shape
 * stays assignable to `AuthenticatedUser`.
 */
export type SessionUserFixture = AuthenticatedUser & { role: string };

/** Account age the fixture presents: old enough to pass rank gates. */
const FIXTURE_USER_AGE_MS = 90 * 24 * 3_600_000;

/**
 * Epoch anchor for every fixture timestamp, captured once at module load:
 * repeated calls in one test produce equal values (fixtures are compared
 * with `toEqual`), and the dates stay anchored to the run itself instead of
 * a hardcoded calendar date that drifts into the past.
 */
const FIXTURE_EPOCH = Date.now();

/**
 * Complete, correctly typed Better-Auth session user fixture. Every field of
 * {@link SessionUserFixture} is populated, so tests can pass narrow overrides
 * (`{ id: "user-2" }`, `{ role: "moderator" }`) without `as` casts. Timestamps
 * are relative to call time so the fixture never drifts out of validity.
 */
export const makeSessionUser = (
  overrides: Partial<SessionUserFixture> = {},
): SessionUserFixture => ({
  createdAt: new Date(FIXTURE_EPOCH - FIXTURE_USER_AGE_MS),
  email: "user-1@test.local",
  emailVerified: true,
  id: "user-1",
  image: null,
  name: "Test User",
  role: "novice",
  twoFactorEnabled: false,
  updatedAt: new Date(FIXTURE_EPOCH),
  username: "user-1",
  ...overrides,
});

/**
 * Full `AuthSession` fixture for `getSession` mocks. The session row is
 * populated for the fixture user unless overridden; pass user overrides as
 * the first argument (e.g. `makeAuthSession({ id: "user-1", role: "admin" })`).
 * Timestamps are relative to call time so the session is always valid.
 */
export const makeAuthSession = (
  userOverrides: Partial<SessionUserFixture> = {},
  sessionOverrides: Partial<Session> = {},
): AuthSession => {
  const user = makeSessionUser(userOverrides);
  return {
    session: {
      createdAt: new Date(FIXTURE_EPOCH),
      expiresAt: new Date(FIXTURE_EPOCH + 3_600_000),
      id: "session-1",
      ipAddress: "127.0.0.1",
      token: "session-token-1",
      updatedAt: new Date(FIXTURE_EPOCH),
      userAgent: "vitest",
      userId: user.id,
      ...sessionOverrides,
    },
    user,
  };
};
