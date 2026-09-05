import { useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useContext } from "react";

import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import { PlaylistsFnsContext } from "./playlists.fn-context";
import { playlistsKeys } from "./playlists.queries";
import type { PlaylistDetailPage } from "./playlists.queries";

export function useCreatePlaylist(userId: string) {
  const queryClient = useQueryClient();
  const { createPlaylist } = useContext(PlaylistsFnsContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to create playlist",
    errorTitle: "Error creating playlist",
    mutationFn: async (data: {
      title: string;
      description?: string;
      isPublic?: boolean;
    }) => createPlaylist({ data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.userPlaylists(userId),
      });
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.all,
      });
    },
    successDescription: "Your playlist has been created.",
    successTitle: "Playlist created",
  });
}

export function useUpdatePlaylist(userId: string) {
  const queryClient = useQueryClient();
  const { updatePlaylist } = useContext(PlaylistsFnsContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to update playlist",
    errorTitle: "Error updating playlist",
    mutationFn: async (data: {
      playlistId: number;
      title?: string;
      description?: string;
      isPublic?: boolean;
    }) => updatePlaylist({ data }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.userPlaylists(userId),
      });
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.detailForPlaylist(variables.playlistId),
      });
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.all,
      });
    },
    successDescription: "Your playlist has been updated.",
    successTitle: "Playlist updated",
  });
}

export function useDeletePlaylist(userId: string) {
  const queryClient = useQueryClient();
  const { deletePlaylist } = useContext(PlaylistsFnsContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to delete playlist",
    errorTitle: "Error deleting playlist",
    mutationFn: async (data: { playlistId: number }) =>
      deletePlaylist({ data }),
    onMutate: async ({ playlistId }) => {
      await queryClient.cancelQueries({
        queryKey: playlistsKeys.userPlaylists(userId),
      });
      const previous = queryClient.getQueryData(
        playlistsKeys.userPlaylists(userId),
      );
      // SAFETY: the cached user-playlist list holds row objects; the filter only
      // reads p.id, so this minimal shape assertion is all the updater needs.
      queryClient.setQueryData(playlistsKeys.userPlaylists(userId), (old) =>
        (old as Array<{ id: number }> | undefined)?.filter(
          (p) => p.id !== playlistId,
        ),
      );
      return { previous };
    },
    onError: (error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          playlistsKeys.userPlaylists(userId),
          context.previous,
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.all,
      });
    },
    successDescription: "Your playlist has been deleted.",
    successTitle: "Playlist deleted",
  });
}

export function useAddPostToPlaylist(userId: string) {
  const queryClient = useQueryClient();
  const { addPostToPlaylist } = useContext(PlaylistsFnsContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to add post to playlist",
    errorTitle: "Error adding to playlist",
    mutationFn: async (data: { playlistId: number; postId: number }) =>
      addPostToPlaylist({ data }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.forPost(variables.postId),
      });
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.detailForPlaylist(variables.playlistId),
      });
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.userPlaylists(userId),
      });
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.all,
      });
    },
    successDescription: "Post added to playlist.",
    successTitle: "Added to playlist",
  });
}

export function useRemovePostFromPlaylist(userId: string) {
  const queryClient = useQueryClient();
  const { removePostFromPlaylist } = useContext(PlaylistsFnsContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to remove post from playlist",
    errorTitle: "Error removing from playlist",
    mutationFn: async (data: { playlistId: number; postId: number }) =>
      removePostFromPlaylist({ data }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.forPost(variables.postId),
      });
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.detailForPlaylist(variables.playlistId),
      });
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.userPlaylists(userId),
      });
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.all,
      });
    },
    successDescription: "Post removed from playlist.",
    successTitle: "Removed from playlist",
  });
}

/**
 * Reorders every post in a playlist. The server function requires the
 * submitted items to cover every playlist post exactly once, so callers must
 * always pass the complete new ordering (the manage table therefore only
 * enables dragging once every page is loaded).
 *
 * The reorder is applied optimistically: cached detail pages are re-chunked
 * in the new order and rolled back if the server call fails.
 */
export function useReorderPlaylistPosts() {
  const queryClient = useQueryClient();
  const { reorderPlaylistPosts } = useContext(PlaylistsFnsContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to reorder the playlist",
    errorTitle: "Error reordering playlist",
    mutationFn: async (data: { playlistId: number; postIds: number[] }) =>
      reorderPlaylistPosts({
        data: {
          items: data.postIds.map((postId, position) => ({
            position,
            postId,
          })),
          playlistId: data.playlistId,
        },
      }),
    onMutate: async ({ playlistId, postIds }) => {
      const queryKey = playlistsKeys.detailForPlaylist(playlistId);
      await queryClient.cancelQueries({ queryKey });
      const previous =
        queryClient.getQueryData<InfiniteData<PlaylistDetailPage>>(queryKey);

      queryClient.setQueryData<InfiniteData<PlaylistDetailPage>>(
        queryKey,
        (old) => {
          if (!old) return old;

          const order = new Map<number, number>(
            postIds.map((postId, index) => [postId, index]),
          );
          const ordered = old.pages
            .flatMap((page) => page.data)
            .sort(
              (a, b) =>
                (order.get(a.post_id) ?? Number.MAX_SAFE_INTEGER) -
                (order.get(b.post_id) ?? Number.MAX_SAFE_INTEGER),
            );

          // Re-chunk the flat ordering back into pages so the infinite query
          // pagination stays intact.
          const pages: PlaylistDetailPage[] = [];
          let cursor = 0;
          for (const page of old.pages) {
            pages.push({
              ...page,
              data: ordered.slice(cursor, cursor + page.data.length),
            });
            cursor += page.data.length;
          }
          return { ...old, pages };
        },
      );
      return { previous };
    },
    onError: (_error, { playlistId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          playlistsKeys.detailForPlaylist(playlistId),
          context.previous,
        );
      }
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.detailForPlaylist(playlistId),
      });
    },
    onSuccess: (_, { playlistId }) => {
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.detailForPlaylist(playlistId),
      });
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.all,
      });
    },
    successDescription: "The playlist order has been updated.",
    successTitle: "Playlist reordered",
  });
}
