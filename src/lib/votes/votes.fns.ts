import type { VotesFns } from "./votes.fn-context";
import {
  fetchLikedPosts,
  fetchPostVotes,
  removePostVote,
  setPostVote,
} from "./votes.service";

export const defaultVotesFns: VotesFns = {
  fetchLikedPosts,
  fetchPostVotes,
  removePostVote,
  setPostVote,
};
