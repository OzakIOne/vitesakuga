export const savedSearchesKeys = {
  all: ["saved-searches"] as const,
  list: () => [...savedSearchesKeys.all, "list"] as const,
} as const;
