import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = join(import.meta.dirname, "..", "..");
const GUARDED_DIRECTORIES = ["src/components", "src/routes"];

const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;
const LITERAL_QUERY_KEY = /queryKey:\s*\[/;
const QUERY_CLIENT_WRITE =
  /\.(invalidateQueries|setQueryData|removeQueries|cancelQueries|refetchQueries|resetQueries)\(/;

const KEY_FIX =
  "use the domain key factory from its *.queries.ts file (for example postsKeys.detail(postId)) instead of an array literal";
const WRITE_FIX =
  "move this QueryClient write into the domain's *.hooks.ts (a mutation's onMutate/onSuccess/onSettled, or a hook that returns the refresh) and call that hook here";

const RULES = [
  { fix: KEY_FIX, pattern: LITERAL_QUERY_KEY },
  { fix: WRITE_FIX, pattern: QUERY_CLIENT_WRITE },
] as const;

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    const isGuarded =
      SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name);
    return isGuarded ? [path] : [];
  });

const findViolations = (): string[] =>
  GUARDED_DIRECTORIES.flatMap((directory) =>
    collectSourceFiles(join(REPOSITORY_ROOT, directory)),
  ).flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, index) =>
        RULES.filter(({ pattern }) => pattern.test(line)).map(
          ({ fix }) =>
            `${relative(REPOSITORY_ROOT, file)}:${index + 1}: ${line.trim()}\n    fix: ${fix}`,
        ),
      ),
  );

describe("query cache boundary", () => {
  it("keeps query keys and QueryClient writes out of components and routes", () => {
    expect(
      findViolations(),
      "Components and routes must only call hooks.",
    ).toEqual([]);
  });
});
