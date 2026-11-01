import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = join(import.meta.dirname, "..", "..");
const SERVICE_ROOT = join(REPOSITORY_ROOT, "src", "lib");
const SERVICE_FILE = /\.service\.ts$/;

const HANDLER_LAMBDA_ALLOWLIST: ReadonlyArray<string> = [];

const STATIC_ACCESSOR = /static readonly \w+ = Effect\.fn\b/;
const HANDLER_LAMBDA = /\bcreateHandler\(/;

const ACCESSOR_FIX =
  "delete the static accessor and call the operation through the service tag: Effect.flatMap(XService, (service) => service.op(...)) inside a handler, or yield* XService inside Effect.gen";
const HANDLER_FIX =
  "use createEndpointHandler({ service, operation, layer, base }) from src/lib/server-endpoint.ts; when the wire input differs from the operation's input, change the operation to accept the validated input object instead of adding a createHandler lambda";

const collectServiceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectServiceFiles(path);
    return SERVICE_FILE.test(entry.name) ? [path] : [];
  });

const findViolations = (): string[] =>
  collectServiceFiles(SERVICE_ROOT).flatMap((file) => {
    const path = relative(REPOSITORY_ROOT, file);
    const isAllowlisted = HANDLER_LAMBDA_ALLOWLIST.includes(path);
    return readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, index) => {
        const location = `${path}:${index + 1}: ${line.trim()}`;
        const violations: string[] = [];
        if (STATIC_ACCESSOR.test(line)) {
          violations.push(`${location}\n    fix: ${ACCESSOR_FIX}`);
        }
        if (HANDLER_LAMBDA.test(line) && !isAllowlisted) {
          violations.push(`${location}\n    fix: ${HANDLER_FIX}`);
        }
        return violations;
      });
  });

describe("service endpoint boundary", () => {
  it("keeps service files free of static accessors and createHandler lambdas", () => {
    expect(
      findViolations(),
      "Server functions go through createEndpointHandler; callers reach operations through the service tag.",
    ).toEqual([]);
  });
});
