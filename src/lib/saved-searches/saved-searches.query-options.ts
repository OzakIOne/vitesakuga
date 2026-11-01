import { queryOptions } from "@tanstack/react-query";

import { savedSearchesKeys } from "./saved-searches.queries";
import { fetchSavedSearches } from "./saved-searches.service";

export const savedSearchesQueryOptions = () =>
  queryOptions({
    gcTime: 5 * 60 * 1000,
    queryFn: () => fetchSavedSearches(),
    queryKey: savedSearchesKeys.list(),
    staleTime: 30 * 1000,
  });
