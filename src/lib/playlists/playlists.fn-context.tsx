import { createContext } from "react";

import {
  createPlaylist as _createPlaylist,
  updatePlaylist as _updatePlaylist,
  deletePlaylist as _deletePlaylist,
  addPostToPlaylist as _addPostToPlaylist,
  bulkAddPostsToPlaylist as _bulkAddPostsToPlaylist,
  bulkRemovePostsFromPlaylist as _bulkRemovePostsFromPlaylist,
  removePostFromPlaylist as _removePostFromPlaylist,
  reorderPlaylistPosts as _reorderPlaylistPosts,
} from "./playlists.service";

export const defaultPlaylistsFns = {
  addPostToPlaylist: _addPostToPlaylist,
  bulkAddPostsToPlaylist: _bulkAddPostsToPlaylist,
  bulkRemovePostsFromPlaylist: _bulkRemovePostsFromPlaylist,
  createPlaylist: _createPlaylist,
  deletePlaylist: _deletePlaylist,
  removePostFromPlaylist: _removePostFromPlaylist,
  reorderPlaylistPosts: _reorderPlaylistPosts,
  updatePlaylist: _updatePlaylist,
};

export const PlaylistsFnsContext = createContext(defaultPlaylistsFns);
