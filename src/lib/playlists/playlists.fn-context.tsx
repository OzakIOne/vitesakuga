import { createContext } from "react";

import {
  createPlaylist as _createPlaylist,
  updatePlaylist as _updatePlaylist,
  deletePlaylist as _deletePlaylist,
  addPostToPlaylist as _addPostToPlaylist,
  removePostFromPlaylist as _removePostFromPlaylist,
  reorderPlaylistPosts as _reorderPlaylistPosts,
} from "./playlists.service";

export const defaultPlaylistsFns = {
  addPostToPlaylist: _addPostToPlaylist,
  createPlaylist: _createPlaylist,
  deletePlaylist: _deletePlaylist,
  removePostFromPlaylist: _removePostFromPlaylist,
  reorderPlaylistPosts: _reorderPlaylistPosts,
  updatePlaylist: _updatePlaylist,
};

export const PlaylistsFnsContext = createContext(defaultPlaylistsFns);
