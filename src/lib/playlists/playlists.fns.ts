import type { PlaylistsFns } from "./playlists.fn-context";
import {
  addPostToPlaylist,
  bulkAddPostsToPlaylist,
  bulkRemovePostsFromPlaylist,
  createPlaylist,
  deletePlaylist,
  removePostFromPlaylist,
  reorderPlaylistPosts,
  updatePlaylist,
} from "./playlists.service";

export const defaultPlaylistsFns: PlaylistsFns = {
  addPostToPlaylist,
  bulkAddPostsToPlaylist,
  bulkRemovePostsFromPlaylist,
  createPlaylist,
  deletePlaylist,
  removePostFromPlaylist,
  reorderPlaylistPosts,
  updatePlaylist,
};
