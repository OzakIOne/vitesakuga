import { createContext, useContext } from "react";

import type {
  fetchLikedPosts,
  fetchPostVotes,
  removePostVote,
  setPostVote,
} from "./votes.service";

export type VotesFns = {
  fetchLikedPosts: typeof fetchLikedPosts;
  fetchPostVotes: typeof fetchPostVotes;
  removePostVote: typeof removePostVote;
  setPostVote: typeof setPostVote;
};

export const VotesFnsContext = createContext<VotesFns | null>(null);

export const useVotesFns = (): VotesFns => {
  const fns = useContext(VotesFnsContext);
  if (fns === null) {
    throw new Error("VotesFnsContext is not provided");
  }
  return fns;
};
