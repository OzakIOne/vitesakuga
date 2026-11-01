import { slugifyUsername, USERNAME_MAX_LENGTH } from "../mentions/mentions";

/**
 * Server-side username generation for sign-ups. Every account needs a unique
 * handle for @mentions, including social (GitHub/Google) sign-ups that never
 * type one. Called from Better Auth's `user.create.before` database hook
 * (src/lib/auth/index.ts), which passes a lookup on the sign-up transaction so
 * the check never waits on a connection that transaction holds.
 */
export const generateUsername = async (input: {
  readonly isTaken: (candidate: string) => Promise<boolean>;
  readonly name: string;
}): Promise<string> => {
  const base = slugifyUsername(input.name);
  if (!(await input.isTaken(base))) {
    return base;
  }
  // Collision: append a random suffix until the handle is free. The slug is
  // capped at 24 chars, so `slug_<4 chars>` always fits the 30-char max.
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${base}_${suffix}`.slice(0, USERNAME_MAX_LENGTH);
    if (!(await input.isTaken(candidate))) {
      return candidate;
    }
  }
  // Effectively unreachable; a time-based suffix ends the loop deterministically.
  return `${base}_${Date.now().toString(36)}`.slice(0, USERNAME_MAX_LENGTH);
};
