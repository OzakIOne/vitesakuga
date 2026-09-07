import { createListCollection } from "@ark-ui/react";
import { useLiveQuery } from "@tanstack/react-db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { tagsCollection } from "src/lib/db/collections";
import { useMutationWithFeedback } from "src/lib/mutations/mutation-feedback";
import type { Tag } from "src/lib/posts/posts.schema";

import {
  tagFollowStateQuery,
  tagsKeys,
  updateTagFollowed,
} from "./tags.queries";

export function useTagCollection(options: {
  search: string;
  exclude?: string[];
}) {
  const { search, exclude = [] } = options;

  const { data: allTags } = useLiveQuery((q) =>
    q.from({ t: tagsCollection }).orderBy(({ t }) => t.name, "asc"),
  );

  // SAFETY: the live query's collection returns tag rows matching the Tag
  // shape; the live-query collection is weakly typed so the rows are asserted.
  const typedTags = allTags as Tag[];
  const excludeSet = useMemo(() => new Set(exclude), [exclude]);
  const filteredTags = useMemo(
    () =>
      typedTags.filter(
        (tag) =>
          !excludeSet.has(tag.name) &&
          tag.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [excludeSet, search, typedTags],
  );
  const collection = useMemo(
    () => createListCollection({ items: filteredTags.map((tag) => tag.name) }),
    [filteredTags],
  );

  return { allTags: typedTags, filteredTags, collection };
}

export function useTagFollowState(tagName: string, enabled: boolean) {
  return useQuery(tagFollowStateQuery(tagName, enabled));
}

export function useSetTagFollowed(tagName: string) {
  const queryClient = useQueryClient();

  return useMutationWithFeedback({
    errorFallback: "Could not update followed tags",
    errorTitle: "Followed tags could not be updated",
    mutationFn: async (followed: boolean) =>
      updateTagFollowed({ followed, tagName }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: tagsKeys.followState(tagName),
      });
      await queryClient.invalidateQueries({
        queryKey: ["posts", "searchInfinite"],
      });
    },
    successDescription: "Your followed-tag feed will use this preference.",
    successTitle: "Followed tags updated",
  });
}
