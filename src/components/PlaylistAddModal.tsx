import {
  Box,
  Button,
  Checkbox,
  Dialog,
  HStack,
  Input,
  Portal,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useContext, useState } from "react";
import { toaster } from "src/components/ui/toaster";
import { PlaylistsFnsContext } from "src/lib/playlists/playlists.fn-context";
import {
  playlistsKeys,
  playlistsQueryForPost,
} from "src/lib/playlists/playlists.queries";

type PlaylistAddModalProps = {
  onCancel: () => void;
  postId: number;
  userId: string;
};

export function PlaylistAddModal({
  onCancel,
  postId,
  userId,
}: PlaylistAddModalProps) {
  const { addPostToPlaylist, createPlaylist, removePostFromPlaylist } =
    useContext(PlaylistsFnsContext);
  const queryClient = useQueryClient();

  const queryKey = playlistsKeys.forPost(postId);
  const { data: playlists } = useQuery(playlistsQueryForPost(postId));

  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const showErrorToast = ({
    error,
    retry,
    title,
  }: {
    error: unknown;
    retry?: () => void;
    title: string;
  }) => {
    toaster.create({
      action: retry ? { label: "Retry", onClick: retry } : undefined,
      closable: true,
      description:
        error instanceof Error ? error.message : "Something went wrong",
      duration: 8000,
      title,
      type: "error",
    });
  };

  const showSuccessToast = ({
    description,
    title,
  }: {
    description: string;
    title: string;
  }) => {
    toaster.create({
      closable: true,
      description,
      duration: 3000,
      title,
      type: "success",
    });
  };

  const runAdd = async (playlistId: number, onRetry: () => void) => {
    try {
      await addPostToPlaylist({ data: { playlistId, postId } });
    } catch (error) {
      void queryClient.invalidateQueries({ queryKey });
      showErrorToast({
        error,
        retry: onRetry,
        title: "Error adding to playlist",
      });
      return;
    }

    showSuccessToast({
      description: "The post was added to the playlist.",
      title: "Added to playlist",
    });
    void queryClient.invalidateQueries({
      queryKey: playlistsKeys.userPlaylists(userId),
    });
  };

  const runRemove = async (playlistId: number, onRetry: () => void) => {
    try {
      await removePostFromPlaylist({ data: { playlistId, postId } });
    } catch (error) {
      void queryClient.invalidateQueries({ queryKey });
      showErrorToast({
        error,
        retry: onRetry,
        title: "Error removing from playlist",
      });
      return;
    }

    showSuccessToast({
      description: "The post was removed from the playlist.",
      title: "Removed from playlist",
    });
    void queryClient.invalidateQueries({
      queryKey: playlistsKeys.userPlaylists(userId),
    });
  };

  const handleToggle = async (playlistId: number, currentlyAdded: boolean) => {
    queryClient.setQueryData(queryKey, (old: typeof playlists) =>
      old?.map((p) =>
        p.id === playlistId ? { ...p, contains_post: !currentlyAdded } : p,
      ),
    );

    const retry = () => void handleToggle(playlistId, currentlyAdded);

    if (currentlyAdded) {
      await runRemove(playlistId, retry);
    } else {
      await runAdd(playlistId, retry);
    }
  };

  const handleCreateAndAdd = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed || isCreating) return;

    setIsCreating(true);
    let createdPlaylistId: number | undefined;
    try {
      const playlist = await createPlaylist({
        data: { title: trimmed, isPublic: false },
      });
      createdPlaylistId = playlist.id;
      setNewTitle("");
      await addPostToPlaylist({
        data: { playlistId: playlist.id, postId },
      });
    } catch (error) {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.userPlaylists(userId),
      });
      const retry = createdPlaylistId
        ? () => void handleToggle(createdPlaylistId as number, false)
        : undefined;
      showErrorToast({
        error,
        ...(retry ? { retry } : {}),
        title: createdPlaylistId
          ? "Error adding to playlist"
          : "Error creating playlist",
      });
      return;
    } finally {
      setIsCreating(false);
    }

    showSuccessToast({
      description: "The playlist was created and the post was added.",
      title: "Playlist created",
    });
    await queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({
      queryKey: playlistsKeys.userPlaylists(userId),
    });
  };

  return (
    <Dialog.Root
      defaultOpen
      onEscapeKeyDown={onCancel}
      onInteractOutside={onCancel}
      onOpenChange={(e) => {
        if (!e.open) onCancel();
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="sm">
            <Dialog.Header>
              <Dialog.Title>Add to playlist</Dialog.Title>
              <Dialog.CloseTrigger onClick={onCancel} />
            </Dialog.Header>

            <Dialog.Body>
              <VStack align="stretch" gap={3}>
                {playlists && playlists.length > 0 ? (
                  playlists.map((p) => (
                    <Checkbox.Root
                      checked={p.contains_post}
                      key={p.id}
                      onCheckedChange={() =>
                        void handleToggle(p.id, p.contains_post)
                      }
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Label>{p.title}</Checkbox.Label>
                    </Checkbox.Root>
                  ))
                ) : (
                  <Text color="gray.500" fontSize="sm">
                    No playlists yet. Create one below.
                  </Text>
                )}

                <Box borderTop="1px" borderColor="gray.100" pt={3}>
                  <HStack>
                    <Input
                      disabled={isCreating}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleCreateAndAdd();
                      }}
                      placeholder="New playlist name..."
                      size="xs"
                      value={newTitle}
                    />
                    <Button
                      disabled={!newTitle.trim() || isCreating}
                      loading={isCreating}
                      onClick={() => void handleCreateAndAdd()}
                      size="xs"
                    >
                      Create
                    </Button>
                  </HStack>
                </Box>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <Button onClick={onCancel} size="sm">
                Done
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
