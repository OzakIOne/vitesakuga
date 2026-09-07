import { useQueryClient } from "@tanstack/react-query";

import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import { savedSearchesKeys } from "./saved-searches.queries";
import type { SaveSearchInput } from "./saved-searches.schema";
import { deleteSavedSearch, saveSearch } from "./saved-searches.service";

export function useSaveSearch() {
  const queryClient = useQueryClient();

  return useMutationWithFeedback({
    errorFallback: "Failed to save this search",
    errorTitle: "Error saving search",
    mutationFn: async (data: SaveSearchInput) => saveSearch({ data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedSearchesKeys.all });
    },
    successDescription: "You can find it again from the search box.",
    successTitle: "Search saved",
  });
}

export function useDeleteSavedSearch() {
  const queryClient = useQueryClient();

  return useMutationWithFeedback({
    errorFallback: "Failed to delete this saved search",
    errorTitle: "Error deleting saved search",
    mutationFn: async (id: number) => deleteSavedSearch({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedSearchesKeys.all });
    },
    successDescription: "The saved search has been removed.",
    successTitle: "Search deleted",
  });
}
