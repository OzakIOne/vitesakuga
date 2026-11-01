import { queryOptions } from "@tanstack/react-query";

import { tagsKeys } from "./tags.queries";
import {
  getAllPopularTags,
  getTagFollowState,
  setTagFollowed,
} from "./tags.service";

export const tagsQueryGetPopularTags = () =>
  queryOptions({
    gcTime: 5 * 60 * 1000, // 5 minutes
    queryFn: () => getAllPopularTags(),
    queryKey: tagsKeys.popular(),
    staleTime: 30 * 1000, // 30 seconds
  });

export const tagFollowStateQuery = (tagName: string, enabled: boolean) =>
  queryOptions({
    enabled,
    queryFn: () => getTagFollowState({ data: { tagName } }),
    queryKey: tagsKeys.followState(tagName),
    staleTime: 5 * 60 * 1000,
  });

export const updateTagFollowed = (data: {
  readonly followed: boolean;
  readonly tagName: string;
}) => setTagFollowed({ data });
