import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = join(import.meta.dirname, "..", "..");
const SOURCE_ROOT = join(REPOSITORY_ROOT, "src", "lib");
const UI_SOURCE_ROOTS = [
  join(REPOSITORY_ROOT, "src", "routes"),
  join(REPOSITORY_ROOT, "src", "components"),
  join(REPOSITORY_ROOT, "src", "features"),
];
const POLICY_MODULE = join(SOURCE_ROOT, "auth", "policy.ts");
const GUARD_MODULE = join(SOURCE_ROOT, "authorization-boundary.test.ts");
const CONTRIBUTOR_PROFILE = join(
  REPOSITORY_ROOT,
  "src",
  "components",
  "users",
  "ContributorProfile.tsx",
);
const SERVICE_FILE = /\.service\.ts$/;
const SOURCE_FILE = /\.tsx?$/;

const RANK_HELPER =
  /\b(roleAtLeast|isStaffRole|STAFF_ROLE_FLOOR|ensureOwnedOrStaff|ensureOwned)\b/;
const ROLE_LABEL_LOOKUP = /\b(getUserRole|roleOf)\b/;

const RANK_FIX =
  "decide with authorize({ actor, permission }) or authorizeOwned({ actor, resource, selectOwnerId, own, any, notFound, forbidden }) from src/lib/auth/policy.ts, naming a permission in its catalog";
const ROLE_LOOKUP_FIX =
  "take the actor from SessionService.requireActor (its role is validated) and check a named permission; roleOf is for display in components and routes only";
const UI_PERMISSION_FIX =
  "use useCapabilities().can(permission) or canOnOwned(...) from src/lib/auth/capabilities.context instead of role-based authorization";
const ROLE_PERMISSION_HELPER = /\broleHasPermission\b/;
const ROLE_AUTHORIZATION_COMPARISON =
  /(?:\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.role|\brole)\s*(?:===|!==)\s*[\"'](?:admin|moderator|uploader|novice)[\"']/;
const CONTRIBUTOR_PROGRESS_COMPARISON =
  /\bprofile\.role\s*===\s*[\"']novice[\"']/;

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return SOURCE_FILE.test(entry.name) ? [path] : [];
  });

const findViolations = (): string[] => {
  const serviceViolations = collectSourceFiles(SOURCE_ROOT).flatMap((file) => {
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

  const uiViolations = UI_SOURCE_ROOTS.flatMap((root) =>
    collectSourceFiles(root).flatMap((file) => {
      const path = relative(REPOSITORY_ROOT, file);
      return readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) => {
          const location = `${path}:${index + 1}: ${line.trim()}`;
          const violations: string[] = [];
          if (ROLE_PERMISSION_HELPER.test(line)) {
            violations.push(`${location}\n    fix: ${UI_PERMISSION_FIX}`);
          }
          if (
            ROLE_AUTHORIZATION_COMPARISON.test(line) &&
            !(
              file === CONTRIBUTOR_PROFILE &&
              CONTRIBUTOR_PROGRESS_COMPARISON.test(line)
            )
          ) {
            violations.push(`${location}\n    fix: ${UI_PERMISSION_FIX}`);
          }
          return violations;
        });
    }),
  );

  return [...serviceViolations, ...uiViolations];
};

describe("authorization boundary", () => {
  it("keeps rank checks and role-label lookups inside the policy module", () => {
    expect(
      findViolations(),
      "Authorization goes through src/lib/auth/policy.ts: authorize/authorizeOwned with a named permission, and actors from SessionService.requireActor.",
    ).toEqual([]);
  });
});
