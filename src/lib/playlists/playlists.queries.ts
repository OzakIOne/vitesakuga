import type { Schema } from "effect";

import type {
  fetchPlaylistDetailSchema,
  fetchPublicPlaylistsSchema,
} from "./playlists.schema";
import type {
  fetchPlaylistsForPost,
  PlaylistDetailResult,
} from "./playlists.service";

/**
 * Derived from the service's wire result so the query cache shape can never
 * drift from what the server function actually returns (ISO date strings).
 */
export type PlaylistDetailPage = PlaylistDetailResult;
export type PlaylistsForPost = Awaited<
  ReturnType<typeof fetchPlaylistsForPost>
>;

export const playlistsKeys = {
  all: ["playlists"] as const,
  detail: (params: Schema.Schema.Type<typeof fetchPlaylistDetailSchema>) =>
    [...playlistsKeys.all, "detail", params] as const,
  detailForPlaylist: (playlistId: number) =>
    [...playlistsKeys.all, "detail", { playlistId }] as const,
  forPost: (postId: number) =>
    [...playlistsKeys.all, "forPost", postId] as const,
  publicLists: ["playlists", "public"] as const,
  public: (params: Schema.Schema.Type<typeof fetchPublicPlaylistsSchema>) =>
    [...playlistsKeys.publicLists, params] as const,
  userPlaylists: (userId: string) =>
    [...playlistsKeys.all, "user", userId] as const,
} as const;
