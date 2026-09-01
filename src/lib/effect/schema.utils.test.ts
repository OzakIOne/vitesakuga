import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { safeParseStrictIssues } from "./schema.utils";

const TestSchema = Schema.Struct({
  content: Schema.String.pipe(
    Schema.check(
      Schema.isMinLength(3, { message: "Must be at least 3 characters" }),
    ),
  ),
  title: Schema.String.pipe(
    Schema.check(
      Schema.isMinLength(3, { message: "Must be at least 3 characters" }),
    ),
  ),
});

describe("safeParseStrictIssues", () => {
  it("returns parsed data on success", () => {
    const result = safeParseStrictIssues(TestSchema)({
      content: "hello",
      title: "world",
    });
    expect(result).toEqual({
      data: { content: "hello", title: "world" },
      success: true,
    });
  });

  it("returns per-field issues with paths on failure", () => {
    const result = safeParseStrictIssues(TestSchema)({
      content: "a",
      title: "b",
    });
    if (result.success) {
      throw new Error("expected failure");
    }
    expect(result.issues).toHaveLength(2);
    const paths = result.issues.map((issue) => issue.path[0]).sort();
    expect(paths).toEqual(["content", "title"]);
    for (const issue of result.issues) {
      expect(issue.message).toBe("Must be at least 3 characters");
    }
  });

  it("includes the failing path in the joined message", () => {
    const result = safeParseStrictIssues(TestSchema)({
      content: "a",
      title: "ok title",
    });
    if (result.success) {
      throw new Error("expected failure");
    }
    expect(result.message).toContain('at ["content"]');
  });
});
