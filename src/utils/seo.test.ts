import { describe, expect, it } from "vitest";

import { seo } from "./seo";

describe(seo, () => {
  it("emits social metadata for a route URL", () => {
    expect(
      seo({
        description: "Browse the archive.",
        title: "Posts · ViteSakuga",
        url: "https://sakuga.example/posts",
      }),
    ).toEqual(
      expect.arrayContaining([
        {
          content: "https://sakuga.example/posts",
          name: "og:url",
        },
        { content: "summary", name: "twitter:card" },
      ]),
    );
  });

  it("does not invent a social account for the site", () => {
    const tags = seo({ title: "ViteSakuga" });

    expect(
      tags.some((tag) => "name" in tag && tag.name === "twitter:site"),
    ).toBe(false);
    expect(
      tags.some((tag) => "name" in tag && tag.name === "twitter:creator"),
    ).toBe(false);
  });

  it("marks private routes as non-indexable when requested", () => {
    expect(seo({ noIndex: true, title: "Account" })).toContainEqual({
      content: "noindex, nofollow",
      name: "robots",
    });
  });
});
