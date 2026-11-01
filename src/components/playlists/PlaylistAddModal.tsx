import { Portal } from "@ark-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState } from "src/components/EmptyState";
import { Button } from "src/components/ui/button";
import { Checkbox, Input } from "src/components/ui/field";
import { Box, HStack, VStack } from "src/components/ui/layout";
import { Dialog } from "src/components/ui/overlay";
import { toastError, toastSuccess } from "src/lib/mutations/mutation-feedback";
import {
  useCreatePlaylistForPost,
  useSetPostPlaylistMembership,
} from "src/lib/playlists/playlists.hooks";
import { playlistsQueryForPost } from "src/lib/playlists/playlists.query-options";

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
  const { data: playlists } = useQuery(playlistsQueryForPost(postId));
  const setMembership = useSetPostPlaylistMembership({ postId, userId });
  const createPlaylist = useCreatePlaylistForPost({ postId, userId });

  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleToggle = async (playlistId: number, currentlyAdded: boolean) => {
    const contains = !currentlyAdded;
    const retry = () => void handleToggle(playlistId, currentlyAdded);

    try {
      await setMembership.mutateAsync({ contains, playlistId });
    } catch (error) {
      toastError(
        contains ? "Error adding to playlist" : "Error removing from playlist",
        error,
        "Something went wrong",
        retry,
      );
      return;
    }

    if (contains) {
      toastSuccess("Added to playlist", "The post was added to the playlist.");
    } else {
      toastSuccess(
        "Removed from playlist",
        "The post was removed from the playlist.",
      );
    }
  };

  const createPlaylistOrReport = async (title: string) => {
    try {
      return await createPlaylist.mutateAsync(title);
    } catch (error) {
      toastError("Error creating playlist", error, "Something went wrong");
      return null;
    }
  };

  const handleCreateAndAdd = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed || isCreating) return;

    setIsCreating(true);
    try {
      const playlist = await createPlaylistOrReport(trimmed);
      if (!playlist) return;

      setNewTitle("");
      try {
        await setMembership.mutateAsync({
          contains: true,
          playlistId: playlist.id,
        });
      } catch (error) {
        toastError(
          "Error adding to playlist",
          error,
          "Something went wrong",
          () => void handleToggle(playlist.id, false),
        );
        return;
      }

      toastSuccess(
        "Playlist created",
        "The playlist was created and the post was added.",
      );
    } finally {
      setIsCreating(false);
    }
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
                  <EmptyState
                    description="Create a playlist below to add this post."
                    size="compact"
                    title="No playlists yet"
                    titleAs="h3"
                  />
                )}

                <Box borderTop="1px" borderColor="gray.100" pt={3}>
                  <HStack>
                    <Input
                      aria-label="New playlist name"
                      disabled={isCreating}
                      name="new-playlist-title"
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
