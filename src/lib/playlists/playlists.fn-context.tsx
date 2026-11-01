import { createContext, useContext } from "react";

import type {
  addPostToPlaylist,
  bulkAddPostsToPlaylist,
  bulkRemovePostsFromPlaylist,
  createPlaylist,
  deletePlaylist,
  removePostFromPlaylist,
  reorderPlaylistPosts,
  updatePlaylist,
} from "./playlists.service";

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

export const PlaylistsFnsContext = createContext<PlaylistsFns | null>(null);

export const usePlaylistsFns = (): PlaylistsFns => {
  const fns = useContext(PlaylistsFnsContext);
  if (fns === null) {
    throw new Error("PlaylistsFnsContext is not provided");
  }
  return fns;
};
