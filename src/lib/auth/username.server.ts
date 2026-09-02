import { eq } from "drizzle-orm";

import { db } from "../db/pool";
import { user } from "../db/schema";
import { slugifyUsername, USERNAME_MAX_LENGTH } from "../mentions/mentions";

/**
 * Server-side username generation for sign-ups. Every account needs a unique
 * handle for @mentions, including social (GitHub/Google) sign-ups that never
 * type one. Called from Better Auth's `user.create.before` database hook
 * (src/lib/auth/index.ts); email sign-ups can be given the same fallback.
 */
const isAvailable = async (candidate: string): Promise<boolean> => {
  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, candidate))
    .limit(1);
  return existing.length === 0;
};

export async function generateUsername(name: string): Promise<string> {
  const base = slugifyUsername(name);
  if (await isAvailable(base)) {
    return base;
  }
  // Collision: append a random suffix until the handle is free. The slug is
  // capped at 24 chars, so `slug_<4 chars>` always fits the 30-char max.
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${base}_${suffix}`.slice(0, USERNAME_MAX_LENGTH);
    if (await isAvailable(candidate)) {
      return candidate;
    }
  }
  // Effectively unreachable; a time-based suffix ends the loop deterministically.
  return `${base}_${Date.now().toString(36)}`.slice(0, USERNAME_MAX_LENGTH);
}
