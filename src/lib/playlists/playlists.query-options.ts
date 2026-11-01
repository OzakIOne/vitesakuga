import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type { Schema } from "effect";

import { playlistsKeys, type PlaylistDetailPage } from "./playlists.queries";
import type {
  fetchPlaylistDetailSchema,
  fetchPublicPlaylistsSchema,
} from "./playlists.schema";
import {
  fetchPlaylistDetail,
  fetchPlaylistsForPost,
  fetchPublicPlaylists,
  fetchUserPlaylists,
} from "./playlists.service";

const PLAYLIST_QUERY_CACHE = {
  gcTime: Infinity,
  staleTime: Infinity,
} as const;

const playlistsQueries = {
  detail: (params: Schema.Schema.Type<typeof fetchPlaylistDetailSchema>) =>
    queryOptions({
      ...PLAYLIST_QUERY_CACHE,
      queryFn: () =>
        fetchPlaylistDetail({
          data: params,
        }),
      queryKey: playlistsKeys.detail(params),
    }),

  forPost: (postId: number) =>
    queryOptions({
      ...PLAYLIST_QUERY_CACHE,
      queryFn: () =>
        fetchPlaylistsForPost({
          data: postId,
        }),
      queryKey: playlistsKeys.forPost(postId),
    }),

  userPlaylists: (userId: string) =>
    queryOptions({
      ...PLAYLIST_QUERY_CACHE,
      queryFn: () =>
        fetchUserPlaylists({
          data: userId,
        }),
      queryKey: playlistsKeys.userPlaylists(userId),
    }),

  public: (params: Schema.Schema.Type<typeof fetchPublicPlaylistsSchema>) =>
    queryOptions({
      ...PLAYLIST_QUERY_CACHE,
      queryFn: () =>
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
    queryFn: ({ pageParam }) =>
      fetchPlaylistDetail({
        data: { playlistId: args.playlistId, page: pageParam },
      }),
    queryKey: playlistsKeys.detailForPlaylist(args.playlistId),
  });
