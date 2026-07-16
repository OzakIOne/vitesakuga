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

  const handleToggle = async (playlistId: number, currentlyAdded: boolean) => {
    queryClient.setQueryData(queryKey, (old: typeof playlists) =>
      old?.map((p) =>
        p.id === playlistId ? { ...p, contains_post: !currentlyAdded } : p,
      ),
    );

    try {
      if (currentlyAdded) {
        await removePostFromPlaylist({ data: { playlistId, postId } });
      } else {
        await addPostToPlaylist({ data: { playlistId, postId } });
      }
    } catch {
      void queryClient.invalidateQueries({ queryKey });
    }

    void queryClient.invalidateQueries({
      queryKey: playlistsKeys.userPlaylists(userId),
    });
  };

  const handleCreateAndAdd = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed || isCreating) return;

    setIsCreating(true);
    try {
      await createPlaylist({ data: { title: trimmed, isPublic: false } });
      setNewTitle("");
      await queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.userPlaylists(userId),
      });
    } catch {
      // error toast handled by the mutation hook
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
