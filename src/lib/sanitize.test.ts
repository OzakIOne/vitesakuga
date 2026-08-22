import { describe, expect, it } from "vitest";

import { sanitize } from "./sanitize";

describe("sanitize", () => {
  it("removes script tags", () => {
    expect(sanitize("<script>alert('xss')</script>")).toBe("");
  });

  it("removes unquoted event handlers (M1 vector)", () => {
    expect(sanitize("<img src=x onerror=alert(1)>")).toBe('<img src="x" />');
  });

  it("removes quoted event handlers", () => {
    expect(sanitize('<a href="#" onclick="alert(1)">x</a>')).toBe(
      '<a href="#">x</a>',
    );
  });

  it("strips javascript: URLs", () => {
    expect(sanitize('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
  });

  it("removes iframe, object and embed elements", () => {
    expect(sanitize('<iframe src="https://evil.example"></iframe>')).toBe("");
    expect(sanitize('<object data="x"></object>')).toBe("");
    expect(sanitize("<embed src=x>")).toBe("");
  });

  it("removes SVG entirely (M1 vector)", () => {
    expect(sanitize("<svg><script>alert(1)</script></svg>")).toBe("");
  });

  it("removes MathML entirely (M1 vector)", () => {
    expect(
      sanitize("<math><mtext><script>alert(1)</script></mtext></math>"),
    ).toBe("");
  });

  it("keeps benign formatting", () => {
    expect(sanitize("<p>Hello <strong>world</strong></p>")).toBe(
      "<p>Hello <strong>world</strong></p>",
    );
  });
});
