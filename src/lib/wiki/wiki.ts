export type WikiArticle = {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  /** Grouping label shown on the wiki index. Keep the set small and stable. */
  readonly category: string;
  readonly loadBody: () => Promise<string>;
};

// Only registered articles are published. Display order on the index follows
// this array, grouped by category. Keep unfinished Markdown out of this list.
export const wikiArticles: readonly WikiArticle[] = [
  {
    slug: "about-vitesakuga",
    title: "What is ViteSakuga?",
    summary:
      "The archive, its two post types, and how the community curates it.",
    category: "About the site",
    loadBody: () =>
      import("src/content/wiki/about-vitesakuga.md?raw").then((m) => m.default),
  },
  {
    slug: "search-operators",
    title: "Search operators",
    summary:
      "Numeric qualifiers and tag exclusions you can combine with free text.",
    category: "Using the site",
    loadBody: () =>
      import("src/content/wiki/search-operators.md?raw").then((m) => m.default),
  },
  {
    slug: "roles-and-points",
    title: "Roles and points",
    summary:
      "How accounts progress from novice to uploader, and what points track.",
    category: "Using the site",
    loadBody: () =>
      import("src/content/wiki/roles-and-points.md?raw").then((m) => m.default),
  },
  {
    slug: "tagging-guidelines",
    title: "Tagging guidelines",
    summary:
      "What makes a good tag, and the conventions posts on ViteSakuga follow.",
    category: "Contributing",
    loadBody: () =>
      import("src/content/wiki/tagging-guidelines.md?raw").then(
        (m) => m.default,
      ),
  },
  {
    slug: "wiki-edit-suggestions",
    title: "Wiki-edit suggestions",
    summary:
      "Propose field-level edits to any post and see how the review works.",
    category: "Contributing",
    loadBody: () =>
      import("src/content/wiki/wiki-edit-suggestions.md?raw").then(
        (m) => m.default,
      ),
  },
];

/** Distinct article categories in first-seen registry order. */
export const wikiCategories = (
  articles: readonly WikiArticle[] = wikiArticles,
): readonly string[] => [...new Set(articles.map((a) => a.category))];

export const findWikiArticle = (slug: string): WikiArticle | undefined =>
  wikiArticles.find((a) => a.slug === slug);
