import { queryOptions } from "@tanstack/react-query";
import { Schema } from "effect";

import type { fetchPlaylistDetailSchema } from "./playlists.schema";
import {
  fetchPlaylistDetail,
  fetchPlaylistsForPost,
  fetchUserPlaylists,
} from "./playlists.service";

const PLAYLIST_QUERY_CACHE = {
  gcTime: Infinity,
  staleTime: Infinity,
} as const;

export const playlistsKeys = {
  all: ["playlists"] as const,
  detail: (params: Schema.Schema.Type<typeof fetchPlaylistDetailSchema>) =>
    [...playlistsKeys.all, "detail", params] as const,
  detailForPlaylist: (playlistId: number) =>
    [...playlistsKeys.all, "detail", { playlistId }] as const,
  forPost: (postId: number) =>
    [...playlistsKeys.all, "forPost", postId] as const,
  userPlaylists: (userId: string) =>
    [...playlistsKeys.all, "user", userId] as const,
} as const;

const playlistsQueries = {
  detail: (params: Schema.Schema.Type<typeof fetchPlaylistDetailSchema>) =>
    queryOptions({
      ...PLAYLIST_QUERY_CACHE,
      queryFn: async () =>
        fetchPlaylistDetail({
          data: params,
        }),
      queryKey: playlistsKeys.detail(params),
    }),

  forPost: (postId: number) =>
    queryOptions({
      ...PLAYLIST_QUERY_CACHE,
      queryFn: async () =>
        fetchPlaylistsForPost({
          data: postId,
        }),
      queryKey: playlistsKeys.forPost(postId),
    }),

  userPlaylists: (userId: string) =>
    queryOptions({
      ...PLAYLIST_QUERY_CACHE,
      queryFn: async () =>
        fetchUserPlaylists({
          data: userId,
        }),
      queryKey: playlistsKeys.userPlaylists(userId),
    }),
};

export const playlistQueryDetail = (
  params: Schema.Schema.Type<typeof fetchPlaylistDetailSchema>,
) => playlistsQueries.detail(params);

export const playlistsQueryForPost = (postId: number) =>
  playlistsQueries.forPost(postId);

export const playlistsQueryUserPlaylists = (userId: string) =>
  playlistsQueries.userPlaylists(userId);
