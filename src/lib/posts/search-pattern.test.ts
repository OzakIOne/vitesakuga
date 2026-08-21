import { describe, expect, it } from "vitest";

import { escapeLikePattern } from "./search-pattern";

describe("escapeLikePattern", () => {
  it("escapes percent wildcards", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
  });

  it("escapes underscore wildcards", () => {
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
  });

  it("escapes the backslash escape character itself", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });

  it("leaves plain text untouched", () => {
    expect(escapeLikePattern("attack on titan")).toBe("attack on titan");
  });
});
