import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";

import type { PostVote } from "../db/schema";
import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import { VotesFnsContext } from "./votes.fn-context";
import { votesKeys, votesQueryGetVotes } from "./votes.queries";

export type PostVotesSummary = {
  dislikes: number;
  likes: number;
  userVote: PostVote | null;
};

export function usePostVotes(postId: number) {
  return useQuery(votesQueryGetVotes(postId));
}

const applyVote = (
  previous: PostVotesSummary | undefined,
  nextVote: PostVote | null,
): PostVotesSummary => {
  const current = previous ?? { dislikes: 0, likes: 0, userVote: null };
  let { dislikes, likes } = current;

  if (current.userVote === "like") {
    likes = Math.max(0, likes - 1);
  }
  if (current.userVote === "dislike") {
    dislikes = Math.max(0, dislikes - 1);
  }

  if (nextVote === "like") {
    likes += 1;
  }
  if (nextVote === "dislike") {
    dislikes += 1;
  }

  return { dislikes, likes, userVote: nextVote };
};

/**
 * Sets, switches or removes the current user's vote on a post.
 * Pass `"like"` / `"dislike"` to set or switch the vote, `null` to remove it.
 */
export function useSetVote(postId: number) {
  const queryClient = useQueryClient();
  const { removePostVote, setPostVote } = useContext(VotesFnsContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to update your vote",
    errorTitle: "Error updating vote",
    mutationFn: async (vote: PostVote | null) =>
      vote === null
        ? removePostVote({ data: { postId } })
        : setPostVote({ data: { postId, vote } }),
    onMutate: async (vote) => {
      await queryClient.cancelQueries({ queryKey: votesKeys.post(postId) });
      const previous = queryClient.getQueryData<PostVotesSummary>(
        votesKeys.post(postId),
      );
      queryClient.setQueryData<PostVotesSummary>(
        votesKeys.post(postId),
        (old) => applyVote(old, vote),
      );
      return { previous };
    },
    onError: (error, _vote, context) => {
      if (context?.previous) {
        queryClient.setQueryData(votesKeys.post(postId), context.previous);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: votesKeys.post(postId),
      });
    },
    successDescription: "Your vote has been updated.",
    successTitle: "Vote updated",
  });
}
