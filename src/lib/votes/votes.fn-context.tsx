import { createContext } from "react";

import {
  fetchPostVotes as _fetchPostVotes,
  removePostVote as _removePostVote,
  setPostVote as _setPostVote,
} from "./votes.service";

export const defaultVotesFns = {
  fetchPostVotes: _fetchPostVotes,
  removePostVote: _removePostVote,
  setPostVote: _setPostVote,
};

export const VotesFnsContext = createContext(defaultVotesFns);
