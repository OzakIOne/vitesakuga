import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = join(import.meta.dirname, "..", "..");
const SOURCE_ROOT = join(REPOSITORY_ROOT, "src", "lib");
const POLICY_MODULE = join(SOURCE_ROOT, "auth", "policy.ts");
const GUARD_MODULE = join(SOURCE_ROOT, "authorization-boundary.test.ts");
const SERVICE_FILE = /\.service\.ts$/;
const SOURCE_FILE = /\.tsx?$/;

const RANK_HELPER =
  /\b(roleAtLeast|isStaffRole|STAFF_ROLE_FLOOR|ensureOwnedOrStaff|ensureOwned)\b/;
const ROLE_LABEL_LOOKUP = /\b(getUserRole|roleOf)\b/;

const RANK_FIX =
  "decide with authorize({ actor, permission }) or authorizeOwned({ actor, resource, selectOwnerId, own, any, notFound, forbidden }) from src/lib/auth/policy.ts, naming a permission in its catalog";
const ROLE_LOOKUP_FIX =
  "take the actor from SessionService.requireActor (its role is validated) and check a named permission; roleOf is for display in components and routes only";

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return SOURCE_FILE.test(entry.name) ? [path] : [];
  });

const findViolations = (): string[] =>
  collectSourceFiles(SOURCE_ROOT).flatMap((file) => {
    if (file === POLICY_MODULE || file === GUARD_MODULE) return [];
    const path = relative(REPOSITORY_ROOT, file);
    const isService = SERVICE_FILE.test(file);
    return readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, index) => {
        const location = `${path}:${index + 1}: ${line.trim()}`;
        const violations: string[] = [];
        if (RANK_HELPER.test(line)) {
          violations.push(`${location}\n    fix: ${RANK_FIX}`);
        }
        if (isService && ROLE_LABEL_LOOKUP.test(line)) {
          violations.push(`${location}\n    fix: ${ROLE_LOOKUP_FIX}`);
        }
        return violations;
      });
  });

describe("authorization boundary", () => {
  it("keeps rank checks and role-label lookups inside the policy module", () => {
    expect(
      findViolations(),
      "Authorization goes through src/lib/auth/policy.ts: authorize/authorizeOwned with a named permission, and actors from SessionService.requireActor.",
    ).toEqual([]);
  });
});
