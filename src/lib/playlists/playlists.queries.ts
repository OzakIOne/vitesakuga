import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";

import type { fetchPlaylistDetailSchema } from "./playlists.schema";
import {
  fetchPlaylistDetail,
  fetchPlaylistsForPost,
  fetchUserPlaylists,
} from "./playlists.service";

export const playlistsKeys = {
  all: ["playlists"] as const,
  detail: (params: z.infer<typeof fetchPlaylistDetailSchema>) =>
    [...playlistsKeys.all, "detail", params] as const,
  forPost: (postId: number) =>
    [...playlistsKeys.all, "forPost", postId] as const,
  userPlaylists: (userId: string) =>
    [...playlistsKeys.all, "user", userId] as const,
} as const;

const playlistsQueries = {
  detail: (params: z.infer<typeof fetchPlaylistDetailSchema>) =>
    queryOptions({
      gcTime: 5 * 60 * 1000,
      queryFn: async () =>
        fetchPlaylistDetail({
          data: params,
        }),
      queryKey: playlistsKeys.detail(params),
      staleTime: 60 * 1000,
    }),

  forPost: (postId: number) =>
    queryOptions({
      gcTime: 5 * 60 * 1000,
      queryFn: async () =>
        fetchPlaylistsForPost({
          data: postId,
        }),
      queryKey: playlistsKeys.forPost(postId),
      staleTime: 30 * 1000,
    }),

  userPlaylists: (userId: string) =>
    queryOptions({
      gcTime: 5 * 60 * 1000,
      queryFn: async () =>
        fetchUserPlaylists({
          data: userId,
        }),
      queryKey: playlistsKeys.userPlaylists(userId),
      staleTime: 60 * 1000,
    }),
};

export const playlistQueryDetail = (
  params: z.infer<typeof fetchPlaylistDetailSchema>,
) => playlistsQueries.detail(params);

export const playlistsQueryForPost = (postId: number) =>
  playlistsQueries.forPost(postId);

export const playlistsQueryUserPlaylists = (userId: string) =>
  playlistsQueries.userPlaylists(userId);
