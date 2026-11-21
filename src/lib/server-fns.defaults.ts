import {
  addComment,
  deleteComment,
  fetchComments,
  updateComment,
} from "./comments/comments.service";
import {
  assignUserRole,
  fetchAccountModerationEvents,
  fetchModerationOverview,
  suspendUser,
  unsuspendUser,
} from "./moderation/moderation.service";
import {
  addPostToPlaylist,
  bulkAddPostsToPlaylist,
  bulkRemovePostsFromPlaylist,
  createPlaylist,
  deletePlaylist,
  removePostFromPlaylist,
  reorderPlaylistPosts,
  updatePlaylist,
} from "./playlists/playlists.service";
import {
  approveEdit,
  proposeEdit,
  rejectEdit,
} from "./post-edits/post-edits.service";
import {
  createVideoUploadUrl,
  searchPosts,
  updatePost,
  uploadPost,
} from "./posts/posts.service";
import {
  approvePromotion,
  fetchPromotionQueue,
  rejectPromotion,
} from "./promotions/promotions.service";
import type { ServerFns } from "./server-fns.context";
import { previewGc, runGc } from "./videos/videos.service";
import {
  fetchLikedPosts,
  fetchPostVotes,
  removePostVote,
  setPostVote,
} from "./votes/votes.service";

export const defaultServerFns: ServerFns = {
  comments: {
    addComment,
    deleteComment,
    fetchComments,
    updateComment,
  },
  moderation: {
    approvePromotion,
    assignUserRole,
    fetchAccountModerationEvents,
    fetchModerationOverview,
    fetchPromotionQueue,
    previewGc,
    rejectPromotion,
    runGc,
    suspendUser,
    unsuspendUser,
  },
  playlists: {
    addPostToPlaylist,
    bulkAddPostsToPlaylist,
    bulkRemovePostsFromPlaylist,
    createPlaylist,
    deletePlaylist,
    removePostFromPlaylist,
    reorderPlaylistPosts,
    updatePlaylist,
  },
  postEdits: {
    approveEdit,
    proposeEdit,
    rejectEdit,
  },
  posts: {
    createVideoUploadUrl,
    searchPosts,
    updatePost,
    uploadPost,
  },
  votes: {
    fetchLikedPosts,
    fetchPostVotes,
    removePostVote,
    setPostVote,
  },
};
