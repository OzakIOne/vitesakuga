import { createContext, useContext, type ReactNode } from "react";

import type {
  addComment,
  deleteComment,
  fetchComments,
  updateComment,
} from "./comments/comments.service";
import type {
  assignUserRole,
  fetchAccountModerationEvents,
  fetchModerationOverview,
  suspendUser,
  unsuspendUser,
} from "./moderation/moderation.service";
import type {
  addPostToPlaylist,
  bulkAddPostsToPlaylist,
  bulkRemovePostsFromPlaylist,
  createPlaylist,
  deletePlaylist,
  removePostFromPlaylist,
  reorderPlaylistPosts,
  updatePlaylist,
} from "./playlists/playlists.service";
import type {
  approveEdit,
  proposeEdit,
  rejectEdit,
} from "./post-edits/post-edits.service";
import type {
  createVideoUploadUrl,
  searchPosts,
  updatePost,
  uploadPost,
} from "./posts/posts.service";
import type {
  approvePromotion,
  fetchPromotionQueue,
  rejectPromotion,
} from "./promotions/promotions.service";
import type { previewGc, runGc } from "./videos/videos.service";
import type {
  fetchLikedPosts,
  fetchPostVotes,
  removePostVote,
  setPostVote,
} from "./votes/votes.service";

export type CommentsFns = {
  addComment: typeof addComment;
  deleteComment: typeof deleteComment;
  fetchComments: typeof fetchComments;
  updateComment: typeof updateComment;
};

export type ModerationFns = {
  approvePromotion: typeof approvePromotion;
  assignUserRole: typeof assignUserRole;
  fetchAccountModerationEvents: typeof fetchAccountModerationEvents;
  fetchModerationOverview: typeof fetchModerationOverview;
  fetchPromotionQueue: typeof fetchPromotionQueue;
  previewGc: typeof previewGc;
  rejectPromotion: typeof rejectPromotion;
  runGc: typeof runGc;
  suspendUser: typeof suspendUser;
  unsuspendUser: typeof unsuspendUser;
};

export type PlaylistsFns = {
  addPostToPlaylist: typeof addPostToPlaylist;
  bulkAddPostsToPlaylist: typeof bulkAddPostsToPlaylist;
  bulkRemovePostsFromPlaylist: typeof bulkRemovePostsFromPlaylist;
  createPlaylist: typeof createPlaylist;
  deletePlaylist: typeof deletePlaylist;
  removePostFromPlaylist: typeof removePostFromPlaylist;
  reorderPlaylistPosts: typeof reorderPlaylistPosts;
  updatePlaylist: typeof updatePlaylist;
};

export type PostEditsFns = {
  approveEdit: typeof approveEdit;
  proposeEdit: typeof proposeEdit;
  rejectEdit: typeof rejectEdit;
};

export type PostsFns = {
  createVideoUploadUrl: typeof createVideoUploadUrl;
  searchPosts: typeof searchPosts;
  updatePost: typeof updatePost;
  uploadPost: typeof uploadPost;
};

export type VotesFns = {
  fetchLikedPosts: typeof fetchLikedPosts;
  fetchPostVotes: typeof fetchPostVotes;
  removePostVote: typeof removePostVote;
  setPostVote: typeof setPostVote;
};

export type ServerFns = {
  readonly comments: CommentsFns;
  readonly moderation: ModerationFns;
  readonly playlists: PlaylistsFns;
  readonly postEdits: PostEditsFns;
  readonly posts: PostsFns;
  readonly votes: VotesFns;
};

export type PartialServerFns = Partial<ServerFns>;

const ServerFnsContext = createContext<PartialServerFns | null>(null);

export const ServerFnsProvider = ({
  children,
  value,
}: {
  readonly children: ReactNode;
  readonly value: PartialServerFns;
}) => (
  <ServerFnsContext.Provider value={value}>
    {children}
  </ServerFnsContext.Provider>
);

const useDomainFns = <Key extends keyof ServerFns>(
  domain: Key,
): ServerFns[Key] => {
  const fns = useContext(ServerFnsContext);
  const domainFns = fns?.[domain];
  if (domainFns === undefined) {
    throw new Error(`ServerFnsProvider is missing domain "${domain}"`);
  }
  return domainFns;
};

export const useCommentsFns = (): CommentsFns => useDomainFns("comments");
export const useModerationFns = (): ModerationFns => useDomainFns("moderation");
export const usePlaylistsFns = (): PlaylistsFns => useDomainFns("playlists");
export const usePostEditsFns = (): PostEditsFns => useDomainFns("postEdits");
export const usePostsFns = (): PostsFns => useDomainFns("posts");
export const useVotesFns = (): VotesFns => useDomainFns("votes");
