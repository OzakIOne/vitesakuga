import { queryOptions } from "@tanstack/react-query";

import { getAllPopularTags } from "./tags.service";

const tagsKeys = {
  all: ["tags"] as const,
  list: () => [...tagsKeys.all, "all"] as const,
  popular: () => [...tagsKeys.all, "popular"] as const,
} as const;

const tagsQueries = {
  getPopularTags: () =>
    queryOptions({
      gcTime: 5 * 60 * 1000, // 5 minutes
      queryFn: async () => getAllPopularTags(),
      queryKey: tagsKeys.popular(),
      staleTime: 30 * 1000, // 30 seconds
    }),
};

export const tagsQueryGetPopularTags = () => tagsQueries.getPopularTags();
