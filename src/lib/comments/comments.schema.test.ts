import { commentInsertSchema } from "src/lib/db/schema";
import { parse } from "src/lib/effect/schema.utils";
import { describe, expect, it } from "vitest";

// The production server entrypoint registers the Node-safe sanitizer before
// decoding schemas. Keep this test at the same boundary.
import "../sanitize.server";

describe("commentInsertSchema", () => {
  it("sanitizes HTML at the server input boundary", () => {
    const parsed = parse(commentInsertSchema)({
      content: '<script>alert("xss")</script><strong>safe</strong>',
      postId: 1,
    });

    expect(parsed.content).toBe("<strong>safe</strong>");
  });

  it("rejects comments over the storage and notification limit", () => {
    expect(() =>
      parse(commentInsertSchema)({
        content: "x".repeat(2001),
        postId: 1,
      }),
    ).toThrow("Comments must not exceed 2000 characters");
  });
});
