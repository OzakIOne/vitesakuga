import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { Schema } from "effect";

import type {
  fetchPlaylistDetailSchema,
  fetchPublicPlaylistsSchema,
} from "./playlists.schema";
import {
  fetchPlaylistDetail,
  fetchPlaylistsForPost,
  fetchPublicPlaylists,
  fetchUserPlaylists,
  type PlaylistDetailResult,
} from "./playlists.service";

const PLAYLIST_QUERY_CACHE = {
  gcTime: Infinity,
  staleTime: Infinity,
} as const;

/**
 * Derived from the service's wire result so the query cache shape can never
 * drift from what the server function actually returns (ISO date strings).
 */
export type PlaylistDetailPage = PlaylistDetailResult;

export const playlistsKeys = {
  all: ["playlists"] as const,
  detail: (params: Schema.Schema.Type<typeof fetchPlaylistDetailSchema>) =>
    [...playlistsKeys.all, "detail", params] as const,
  detailForPlaylist: (playlistId: number) =>
    [...playlistsKeys.all, "detail", { playlistId }] as const,
  forPost: (postId: number) =>
    [...playlistsKeys.all, "forPost", postId] as const,
  public: (params: Schema.Schema.Type<typeof fetchPublicPlaylistsSchema>) =>
    [...playlistsKeys.all, "public", params] as const,
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

  public: (params: Schema.Schema.Type<typeof fetchPublicPlaylistsSchema>) =>
    queryOptions({
      ...PLAYLIST_QUERY_CACHE,
      queryFn: async () =>
        fetchPublicPlaylists({
          data: params,
        }),
      queryKey: playlistsKeys.public(params),
    }),
};

export const playlistQueryDetail = (
  params: Schema.Schema.Type<typeof fetchPlaylistDetailSchema>,
) => playlistsQueries.detail(params);

export const playlistsQueryForPost = (postId: number) =>
  playlistsQueries.forPost(postId);

export const playlistsQueryUserPlaylists = (userId: string) =>
  playlistsQueries.userPlaylists(userId);

export const publicPlaylistsQueryOptions = (
  params: Schema.Schema.Type<typeof fetchPublicPlaylistsSchema>,
) => playlistsQueries.public(params);

export const playlistsQueryDetailInfinite = (args: {
  playlistId: number;
  initialPage?: number;
}) =>
  infiniteQueryOptions({
    ...PLAYLIST_QUERY_CACHE,
    getNextPageParam: (
      lastPage: PlaylistDetailPage,
      _allPages: readonly PlaylistDetailPage[],
      lastPageParam: number,
    ) => (lastPage.meta.pagination.hasMore ? lastPageParam + 1 : undefined),
    initialPageParam: args.initialPage ?? 0,
    queryFn: async ({ pageParam }) =>
      fetchPlaylistDetail({
        data: { playlistId: args.playlistId, page: pageParam },
      }),
    queryKey: playlistsKeys.detailForPlaylist(args.playlistId),
  });
