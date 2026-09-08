import { describe, expect, it } from "vitest";

import { findWikiArticle, wikiArticles, wikiCategories } from "./wiki";

describe("published wiki content", () => {
  it("has unique URL-safe slugs and complete metadata", () => {
    expect(new Set(wikiArticles.map((article) => article.slug)).size).toBe(
      wikiArticles.length,
    );
    for (const article of wikiArticles) {
      expect(article.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(article.title.trim()).not.toBe("");
      expect(article.summary.trim()).not.toBe("");
      expect(article.category.trim()).not.toBe("");
    }
  });

  it("can load every published article without a duplicate main heading", async () => {
    for (const article of wikiArticles) {
      const body = await article.loadBody();
      expect(body.trim()).not.toBe("");
      expect(body).not.toMatch(/^# /m);
    }
  });

  it("lists every category on the index in registry order", () => {
    expect(wikiCategories()).toEqual([
      "About the site",
      "Using the site",
      "Contributing",
    ]);
    for (const article of wikiArticles) {
      expect(findWikiArticle(article.slug)).toBe(article);
    }
  });
});
