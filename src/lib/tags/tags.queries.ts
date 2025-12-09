import { queryOptions } from "@tanstack/react-query";
import { getAllTags } from "./tags.fn";

export const tagsKeys = {
  all: ["tags"] as const,
  list: () => [...tagsKeys.all, "all"] as const,
} as const;

export const tagsQueries = {
  getTags: () =>
    queryOptions({
      queryKey: tagsKeys.list(),
      queryFn: async () => {
        return getAllTags();
      },
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
    }),
};

// Backward compatibility export
export const tagsQueryGetTags = () => {
  return tagsQueries.getTags();
};
