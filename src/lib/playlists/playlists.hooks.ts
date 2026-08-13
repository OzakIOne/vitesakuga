import { useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";

import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import { PlaylistsFnsContext } from "./playlists.fn-context";
import { playlistsKeys } from "./playlists.queries";

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
      queryClient.setQueryData(
        playlistsKeys.userPlaylists(userId),
        (old: unknown) =>
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
    },
    successDescription: "Post removed from playlist.",
    successTitle: "Removed from playlist",
  });
}
