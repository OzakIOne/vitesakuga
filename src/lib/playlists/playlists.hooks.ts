import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import { toaster } from "src/components/ui/toaster";

import { PlaylistsFnsContext } from "./playlists.fn-context";
import { playlistsKeys } from "./playlists.queries";

export function useCreatePlaylist(userId: string) {
  const queryClient = useQueryClient();
  const { createPlaylist } = useContext(PlaylistsFnsContext);

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      isPublic?: boolean;
    }) => createPlaylist({ data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.userPlaylists(userId),
      });
      toaster.create({
        closable: true,
        description: "Your playlist has been created.",
        duration: 3000,
        title: "Playlist created",
        type: "success",
      });
    },
    onError: (error) => {
      toaster.create({
        closable: true,
        description:
          error instanceof Error ? error.message : "Failed to create playlist",
        duration: 5000,
        title: "Error creating playlist",
        type: "error",
      });
    },
  });
}

export function useUpdatePlaylist(userId: string) {
  const queryClient = useQueryClient();
  const { updatePlaylist } = useContext(PlaylistsFnsContext);

  return useMutation({
    mutationFn: async (data: {
      playlistId: number;
      title?: string;
      description?: string;
      isPublic?: boolean;
    }) => updatePlaylist({ data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.userPlaylists(userId),
      });
      toaster.create({
        closable: true,
        description: "Your playlist has been updated.",
        duration: 3000,
        title: "Playlist updated",
        type: "success",
      });
    },
    onError: (error) => {
      toaster.create({
        closable: true,
        description:
          error instanceof Error ? error.message : "Failed to update playlist",
        duration: 5000,
        title: "Error updating playlist",
        type: "error",
      });
    },
  });
}

export function useDeletePlaylist(userId: string) {
  const queryClient = useQueryClient();
  const { deletePlaylist } = useContext(PlaylistsFnsContext);

  return useMutation({
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
      toaster.create({
        closable: true,
        description:
          error instanceof Error ? error.message : "Failed to delete playlist",
        duration: 5000,
        title: "Error deleting playlist",
        type: "error",
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.userPlaylists(userId),
      });
      toaster.create({
        closable: true,
        description: "Your playlist has been deleted.",
        duration: 3000,
        title: "Playlist deleted",
        type: "success",
      });
    },
  });
}

export function useAddPostToPlaylist() {
  const { addPostToPlaylist } = useContext(PlaylistsFnsContext);

  return useMutation({
    mutationFn: async (data: { playlistId: number; postId: number }) =>
      addPostToPlaylist({ data }),
    onSuccess: () => {
      toaster.create({
        closable: true,
        description: "Post added to playlist.",
        duration: 3000,
        title: "Added to playlist",
        type: "success",
      });
    },
    onError: (error) => {
      toaster.create({
        closable: true,
        description:
          error instanceof Error
            ? error.message
            : "Failed to add post to playlist",
        duration: 5000,
        title: "Error adding to playlist",
        type: "error",
      });
    },
  });
}

export function useRemovePostFromPlaylist() {
  const { removePostFromPlaylist } = useContext(PlaylistsFnsContext);

  return useMutation({
    mutationFn: async (data: { playlistId: number; postId: number }) =>
      removePostFromPlaylist({ data }),
    onSuccess: () => {
      toaster.create({
        closable: true,
        description: "Post removed from playlist.",
        duration: 3000,
        title: "Removed from playlist",
        type: "success",
      });
    },
    onError: (error) => {
      toaster.create({
        closable: true,
        description:
          error instanceof Error
            ? error.message
            : "Failed to remove post from playlist",
        duration: 5000,
        title: "Error removing from playlist",
        type: "error",
      });
    },
  });
}
