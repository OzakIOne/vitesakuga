import { describe, expect, it } from "vitest";

import { parse } from "./effect/schema.utils";
import { PlaylistId, PositiveIntegerFromString, PostId } from "./ids";

describe("entity identifiers", () => {
  it.each([PostId, PlaylistId])(
    "accepts only positive safe integers",
    (schema) => {
      expect(parse(schema)(1)).toBe(1);
      expect(() => parse(schema)(0)).toThrow();
      expect(() => parse(schema)(1.5)).toThrow();
      expect(() => parse(schema)(Number.NaN)).toThrow();
      expect(() => parse(schema)(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    },
  );

  it("accepts only canonical decimal route parameters", () => {
    expect(parse(PositiveIntegerFromString)("42")).toBe(42);
    for (const value of ["0", "-1", "1.5", "abc", "0x10", "1e3", " 5 "]) {
      expect(() => parse(PositiveIntegerFromString)(value)).toThrow();
    }
  });
});
