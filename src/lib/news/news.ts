export type NewsPost = {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  /** Calendar date in YYYY-MM-DD format. Publication happens on deployment. */
  readonly date: string;
  readonly loadBody: () => Promise<string>;
};

// Only registered articles are published. Keep unfinished Markdown out of this list.
export const newsPosts: readonly NewsPost[] = [
  {
    slug: "welcome",
    title: "A new home for ViteSakuga updates",
    summary:
      "Follow new features, improvements, and fixes as ViteSakuga takes shape.",
    date: "2026-09-07",
    loadBody: () =>
      import("src/content/news/welcome.md?raw").then((m) => m.default),
  },
].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export const formatNewsDate = (date: string): string =>
  dateFormatter.format(Date.parse(`${date}T00:00:00Z`));
