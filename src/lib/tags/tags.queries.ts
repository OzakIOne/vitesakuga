import { queryOptions } from "@tanstack/react-query";

import {
  getAllPopularTags,
  getTagFollowState,
  setTagFollowed,
} from "./tags.service";

export const tagsKeys = {
  all: ["tags"] as const,
  list: () => [...tagsKeys.all, "all"] as const,
  popular: () => [...tagsKeys.all, "popular"] as const,
  followState: (tagName: string) =>
    [...tagsKeys.all, "followState", tagName] as const,
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

export const tagFollowStateQuery = (tagName: string, enabled: boolean) =>
  queryOptions({
    enabled,
    queryFn: async () => getTagFollowState({ data: { tagName } }),
    queryKey: tagsKeys.followState(tagName),
    staleTime: 5 * 60 * 1000,
  });

export const updateTagFollowed = (data: {
  readonly followed: boolean;
  readonly tagName: string;
}) => setTagFollowed({ data });
