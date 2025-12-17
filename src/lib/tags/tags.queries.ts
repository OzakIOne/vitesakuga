import { queryOptions } from "@tanstack/react-query";
import { getAllPopularTags, getAllTags } from "./tags.fn";

export const tagsKeys = {
  all: ["tags"] as const,
  list: () => [...tagsKeys.all, "all"] as const,
  popular: () => [...tagsKeys.all, "popular"] as const,
} as const;

export const tagsQueries = {
  getPopularTags: () =>
    queryOptions({
      gcTime: 5 * 60 * 1000, // 5 minutes
      queryFn: async () => getAllPopularTags(),
      queryKey: tagsKeys.popular(),
      staleTime: 30 * 1000, // 30 seconds
    }),
  getTags: () =>
    queryOptions({
      gcTime: 5 * 60 * 1000, // 5 minutes
      queryFn: async () => getAllTags(),
      queryKey: tagsKeys.list(),
      staleTime: 30 * 1000, // 30 seconds
    }),
};

// Backward compatibility export
export const tagsQueryGetTags = () => {
  return tagsQueries.getTags();
};

export const tagsQueryGetPopularTags = () => {
  return tagsQueries.getPopularTags();
};
