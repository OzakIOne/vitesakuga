import { queryOptions } from "@tanstack/react-query";

import { fetchSavedSearches } from "./saved-searches.service";

export const savedSearchesKeys = {
  all: ["saved-searches"] as const,
  list: () => [...savedSearchesKeys.all, "list"] as const,
} as const;

export const savedSearchesQueryOptions = () =>
  queryOptions({
    gcTime: 5 * 60 * 1000,
    queryFn: async () => fetchSavedSearches(),
    queryKey: savedSearchesKeys.list(),
    staleTime: 30 * 1000,
  });
