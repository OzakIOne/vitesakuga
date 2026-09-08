import { describe, expect, it } from "vitest";

import { formatNewsDate, newsPosts } from "./news";

describe("published news content", () => {
  it("has unique URL-safe slugs and valid calendar dates", () => {
    expect(new Set(newsPosts.map((post) => post.slug)).size).toBe(
      newsPosts.length,
    );
    for (const post of newsPosts) {
      expect(post.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(post.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(
        new Date(`${post.date}T00:00:00Z`).toISOString().slice(0, 10),
      ).toBe(post.date);
      expect(post.title.trim()).not.toBe("");
      expect(post.summary.trim()).not.toBe("");
    }
  });

  it("can load every published article without a duplicate main heading", async () => {
    for (const post of newsPosts) {
      const body = await post.loadBody();
      expect(body.trim()).not.toBe("");
      expect(body).not.toMatch(/^# /m);
    }
  });

  it("keeps calendar dates stable across server and browser time zones", () => {
    expect(formatNewsDate("2026-09-07")).toBe("September 7, 2026");
  });
});
