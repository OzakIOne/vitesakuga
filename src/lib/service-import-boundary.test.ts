import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = join(import.meta.dirname, "..", "..");
const SOURCE_ROOT = join(REPOSITORY_ROOT, "src");

const SOURCE_FILE = /\.tsx?$/;
const FN_CONTEXT_FILE = /\.fn-context\.tsx?$/;
const QUERIES_FILE = /\.queries\.tsx?$/;
const IMPORT_STATEMENT =
  /import\s+(type\s+)?([^;]*?)\s+from\s+["']([^"']+\.service)["']/g;

const FIX =
  "keep this file type-only: move the runtime defaults to the domain's *.fns.ts, and keep queries in *.query-options.ts (query keys stay in *.queries.ts)";

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return SOURCE_FILE.test(entry.name) ? [path] : [];
  });

const isGuarded = (file: string): boolean => {
  const name = relative(SOURCE_ROOT, file);
  return (
    FN_CONTEXT_FILE.test(name) ||
    QUERIES_FILE.test(name) ||
    name.startsWith("components/")
  );
};

const TYPE_ONLY_NAMED_IMPORTS = /\{([\s\S]*)\}/;

const isRuntimeImport = ({
  clause,
  typeKeyword,
}: {
  clause: string;
  typeKeyword: string | undefined;
}): boolean => {
  if (typeKeyword !== undefined) return false;
  const named = clause.match(TYPE_ONLY_NAMED_IMPORTS);
  const hasDefaultOrNamespace =
    clause.replace(TYPE_ONLY_NAMED_IMPORTS, "").replace(/,/g, "").trim() !== "";
  if (named === null || named[1] === undefined || hasDefaultOrNamespace) {
    return true;
  }
  return !named[1]
    .split(",")
    .map((specifier) => specifier.trim())
    .filter((specifier) => specifier !== "")
    .every((specifier) => specifier.startsWith("type "));
};

const findViolations = (): string[] =>
  collectSourceFiles(SOURCE_ROOT)
    .filter(isGuarded)
    .flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return [...text.matchAll(IMPORT_STATEMENT)]
        .filter((match) =>
          isRuntimeImport({ clause: match[2] ?? "", typeKeyword: match[1] }),
        )
        .map((match) => {
          const line = text.slice(0, match.index).split("\n").length;
          return `${relative(REPOSITORY_ROOT, file)}:${line}: runtime import of ${match[3]}\n    fix: ${FIX}`;
        });
    });

describe("service import boundary", () => {
  it("keeps service modules out of fn-context, query and component files at runtime", () => {
    expect(
      findViolations(),
      "Fn-context, *.queries.ts and components may only import services as types.",
    ).toEqual([]);
  });
});
