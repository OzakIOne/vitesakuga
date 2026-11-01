export const tagsKeys = {
  all: ["tags"] as const,
  collection: () => [...tagsKeys.all, "collection"] as const,
  list: () => [...tagsKeys.all, "all"] as const,
  popular: () => [...tagsKeys.all, "popular"] as const,
  followState: (tagName: string) =>
    [...tagsKeys.all, "followState", tagName] as const,
} as const;
