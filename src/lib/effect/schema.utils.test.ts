import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  parse,
  parseStrict,
  safeParseStrict,
  safeParseStrictIssues,
  toStandardSchemaV1Strict,
} from "./schema.utils";

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

const NestedSchema = Schema.Struct({
  user: Schema.Struct({ name: Schema.String }),
  items: Schema.Array(Schema.Struct({ qty: Schema.Number })),
});

describe("parse", () => {
  it("returns the decoded value on success", () => {
    expect(parse(TestSchema)({ content: "hello", title: "world" })).toEqual({
      content: "hello",
      title: "world",
    });
  });

  it("is permissive: accepts excess properties", () => {
    const result = parse(TestSchema)({
      content: "hello",
      title: "world",
      extra: "ignored",
    });
    expect(result).toMatchObject({ content: "hello", title: "world" });
  });

  it("throws an Error carrying the schema issue as cause on invalid input", () => {
    let thrown: unknown;
    try {
      parse(TestSchema)({ content: 123, title: "world" });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain('["content"]');
  });
});

describe("parseStrict", () => {
  it("returns the decoded value for exact input", () => {
    expect(
      parseStrict(TestSchema)({ content: "hello", title: "world" }),
    ).toEqual({
      content: "hello",
      title: "world",
    });
  });

  it("rejects excess properties", () => {
    let thrown: unknown;
    try {
      parseStrict(TestSchema)({
        content: "hello",
        title: "world",
        extra: "not allowed",
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain('["extra"]');
  });
});

describe("safeParseStrict", () => {
  it("returns the data on success", () => {
    const result = safeParseStrict(TestSchema)({
      content: "hello",
      title: "world",
    });
    expect(result).toEqual({
      data: { content: "hello", title: "world" },
      success: true,
    });
  });

  it("returns a failure message locating the offending field", () => {
    const result = safeParseStrict(TestSchema)({ content: "a", title: "b" });
    if (result.success) {
      throw new Error("expected failure");
    }
    expect(result.message).toContain("Must be at least 3 characters");
    expect(result.message).toContain('["content"]');
  });

  it("rejects excess properties", () => {
    const result = safeParseStrict(TestSchema)({
      content: "hello",
      title: "world",
      extra: "not allowed",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it("fails on empty object input", () => {
    const result = safeParseStrict(TestSchema)({});
    expect(result.success).toBe(false);
  });

  it("fails on non-object input", () => {
    expect(safeParseStrict(TestSchema)(null).success).toBe(false);
    expect(safeParseStrict(TestSchema)(undefined).success).toBe(false);
    expect(safeParseStrict(TestSchema)("string").success).toBe(false);
  });
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

  it("reports nested object paths", () => {
    const result = safeParseStrictIssues(NestedSchema)({
      user: { name: 123 },
      items: [{ qty: 1 }],
    });
    if (result.success) {
      throw new Error("expected failure");
    }
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].path).toEqual(["user", "name"]);
  });

  it("reports array index paths", () => {
    const result = safeParseStrictIssues(NestedSchema)({
      user: { name: "ok" },
      items: [{ qty: "not a number" }],
    });
    if (result.success) {
      throw new Error("expected failure");
    }
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].path).toEqual(["items", "0", "qty"]);
  });

  it("collects multiple simultaneous issues across fields", () => {
    const result = safeParseStrictIssues(NestedSchema)({
      user: { name: 123 },
      items: [{ qty: "bad" }],
    });
    if (result.success) {
      throw new Error("expected failure");
    }
    expect(result.issues).toHaveLength(2);
    const paths = result.issues.map((issue) => issue.path.join(".")).sort();
    expect(paths).toEqual(["items.0.qty", "user.name"]);
  });

  it("fails on empty object input with issues for every field", () => {
    const result = safeParseStrictIssues(TestSchema)({});
    if (result.success) {
      throw new Error("expected failure");
    }
    const paths = result.issues.map((issue) => issue.path[0]).sort();
    expect(paths).toEqual(["content", "title"]);
  });

  it("fails on unknown (non-object) input", () => {
    for (const input of [null, undefined, "string", 42]) {
      const result = safeParseStrictIssues(TestSchema)(input);
      expect(result.success).toBe(false);
    }
  });
});

describe("toStandardSchemaV1Strict", () => {
  const standard = toStandardSchemaV1Strict(TestSchema);

  const validate = (input: unknown) =>
    standard["~standard"].validate(input) as ReturnType<
      (typeof standard)["~standard"]["validate"]
    > extends Promise<infer T>
      ? T | Promise<T>
      : never;

  it("exposes a Standard Schema v1 interface", () => {
    expect(standard["~standard"].version).toBe(1);
  });

  it("validates equivalent to parseStrict on success", () => {
    const result = validate({ content: "hello", title: "world" });
    if (result instanceof Promise) {
      throw new Error("expected synchronous validation result");
    }
    expect(result).toEqual({
      value: { content: "hello", title: "world" },
    });
  });

  it("rejects excess properties like parseStrict", () => {
    const result = validate({
      content: "hello",
      title: "world",
      extra: "not allowed",
    });
    if (result instanceof Promise) {
      throw new Error("expected synchronous validation result");
    }
    expect(result.issues).toBeDefined();
    expect(result.issues?.length).toBeGreaterThan(0);
    expect(result.issues?.every((issue) => issue.message.length > 0)).toBe(
      true,
    );
  });

  it("reports issues for the same failures parseStrict throws on", () => {
    const result = validate({ content: "a", title: "ok title" });
    if (result instanceof Promise) {
      throw new Error("expected synchronous validation result");
    }
    expect(result.value).toBeUndefined();
    const path = result.issues?.[0]?.path ?? [];
    const segments = path.map((segment) =>
      typeof segment === "object" && "key" in segment ? segment.key : segment,
    );
    expect(segments).toEqual(["content"]);
  });
});
