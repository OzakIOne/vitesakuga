import { queryOptions } from "@tanstack/react-query";

import type { VotesFns } from "./votes.fn-context";
import { votesKeys } from "./votes.queries";
import type { FetchLikedPostsInput } from "./votes.schema";

export const votesQueryOptions = (
  postId: number,
  fetchPostVotesFn: VotesFns["fetchPostVotes"],
) =>
  queryOptions({
    gcTime: 5 * 60 * 1000, // 5 minutes
    queryFn: () => fetchPostVotesFn({ data: postId }),
    queryKey: votesKeys.post(postId),
    staleTime: 30 * 1000, // 30 seconds
  });

export const votesQueryLikedPosts = (
  params: FetchLikedPostsInput,
  fetchLikedPostsFn: VotesFns["fetchLikedPosts"],
) =>
  queryOptions({
    gcTime: 5 * 60 * 1000, // 5 minutes
    queryFn: () => fetchLikedPostsFn({ data: params }),
    queryKey: votesKeys.likedPosts(params),
    staleTime: 30 * 1000, // 30 seconds
  });
