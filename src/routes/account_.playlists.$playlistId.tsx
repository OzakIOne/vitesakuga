import { Portal } from "@ark-ui/react";
import {
  useQueryClient,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Schema } from "effect";
import { useCallback, useContext, useMemo, useState } from "react";
import { PlaylistPostsTable } from "src/components/PlaylistPostsTable";
import type { PlaylistPostTableRow } from "src/components/PlaylistPostsTable";
import { Button, CloseButton } from "src/components/ui/button";
import { Badge } from "src/components/ui/feedback";
import { Field, Input } from "src/components/ui/field";
import { Box, HStack, VStack } from "src/components/ui/layout";
import { Dialog } from "src/components/ui/overlay";
import { Heading, Text } from "src/components/ui/typography";
import { parse } from "src/lib/effect/schema.utils";
import { useMutationWithFeedback } from "src/lib/mutations/mutation-feedback";
import { PlaylistsFnsContext } from "src/lib/playlists/playlists.fn-context";
import {
  useUpdatePlaylist,
  useReorderPlaylistPosts,
} from "src/lib/playlists/playlists.hooks";
import {
  playlistsKeys,
  playlistsQueryDetailInfinite,
} from "src/lib/playlists/playlists.queries";

export const Route = createFileRoute("/account_/playlists/$playlistId")({
  component: ManagePlaylistContent,
  notFoundComponent: () => <NotFoundContent />,
  ssr: "data-only",
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        search: { redirect: location.pathname },
        to: "/login",
      });
    }
    return { user: context.user };
  },
});

function NotFoundContent() {
  return (
    <Box p={4}>
      <Text>Playlist not found</Text>
      <Link to="/account/playlists">
        <Text color="blue.500">Back to my playlists</Text>
      </Link>
    </Box>
  );
}

function parsePostIds(raw: string): number[] {
  return [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
}

function ManagePlaylistContent() {
  const { user } = Route.useRouteContext();
  const params = Route.useParams();
  const playlistId = parse(Schema.NumberFromString)(params.playlistId);

  const queryClient = useQueryClient();
  const { bulkAddPostsToPlaylist, bulkRemovePostsFromPlaylist } =
    useContext(PlaylistsFnsContext);
  const updatePlaylist = useUpdatePlaylist(user.id);
  const reorderPosts = useReorderPlaylistPosts();

  const [selectedPostIds, setSelectedPostIds] = useState<ReadonlySet<number>>(
    new Set(),
  );
  const [postIdsInput, setPostIdsInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSuspenseInfiniteQuery(playlistsQueryDetailInfinite({ playlistId }));

  const playlist = data.pages[0]?.playlist;

  const rows: PlaylistPostTableRow[] = useMemo(
    () =>
      data.pages.flatMap((page) =>
        page.data.map((item): PlaylistPostTableRow => {
          if ("orphan" in item) {
            return {
              postId: item.post_id,
              position: item.position,
              addedAt: item.added_at,
              isOrphan: true,
              id: null,
              title: null,
              description: null,
              thumbnailKey: null,
              createdAt: null,
              userId: null,
              userName: null,
            };
          }
          return {
            postId: item.post_id,
            position: item.position,
            addedAt: item.added_at,
            isOrphan: false,
            id: item.id,
            title: item.title,
            description: item.description,
            thumbnailKey: item.thumbnail_key,
            createdAt: item.created_at,
            userId: item.user_id,
            userName: item.user_name,
          };
        }),
      ),
    [data],
  );

  const handleSelectionChange = useCallback((ids: ReadonlySet<number>) => {
    setSelectedPostIds(ids);
  }, []);

  const invalidatePlaylistQueries = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: playlistsKeys.detailForPlaylist(playlistId),
    });
    void queryClient.invalidateQueries({
      queryKey: playlistsKeys.userPlaylists(user.id),
    });
    void queryClient.invalidateQueries({
      queryKey: playlistsKeys.all,
    });
  }, [playlistId, queryClient, user.id]);

  const addPostsMutation = useMutationWithFeedback({
    errorFallback: "Failed to add posts to the playlist",
    errorTitle: "Error adding posts",
    mutationFn: async (postIds: number[]) =>
      bulkAddPostsToPlaylist({ data: { playlistId, postIds } }),
    onSuccess: () => {
      setPostIdsInput("");
      setAddError(null);
      invalidatePlaylistQueries();
    },
    successTitle: "Posts added",
  });

  const removePostsMutation = useMutationWithFeedback({
    errorFallback: "Failed to remove posts from the playlist",
    errorTitle: "Error removing posts",
    mutationFn: async (postIds: number[]) =>
      bulkRemovePostsFromPlaylist({ data: { playlistId, postIds } }),
    onSuccess: () => {
      setSelectedPostIds(new Set());
      invalidatePlaylistQueries();
    },
    successTitle: "Posts removed",
  });

  const handleAddPosts = () => {
    const ids = parsePostIds(postIdsInput);
    if (ids.length === 0) {
      setAddError("Enter at least one valid post ID");
      return;
    }
    setAddError(null);
    addPostsMutation.mutate(ids);
  };

  if (!playlist || playlist.user_id !== user.id) {
    return (
      <Box p={4}>
        <Text>You can only manage your own playlists.</Text>
        <Link to="/account/playlists">
          <Text color="blue.500">Back to my playlists</Text>
        </Link>
      </Box>
    );
  }

  const selectedCount = selectedPostIds.size;

  return (
    <Box
      display="flex"
      direction="column"
      overflow="hidden"
      p={4}
      style={{ height: "calc(100dvh - 4rem)" }}
    >
      <VStack align="start" gap={2} mb={6}>
        <Heading as="h1" size="2xl">
          {playlist.title}
        </Heading>
        {playlist.description && (
          <Text color="gray.500">{playlist.description}</Text>
        )}
        <HStack gap={4}>
          <Text color="gray.500" fontSize="sm">
            {playlist.post_count} post
            {playlist.post_count !== 1 ? "s" : ""}
          </Text>
          <Badge
            borderRadius="full"
            colorPalette={playlist.is_public ? "green" : "gray"}
            px={2}
            size="sm"
          >
            {playlist.is_public ? "Public" : "Private"}
          </Badge>
          <Button
            aria-pressed={playlist.is_public}
            colorPalette={playlist.is_public ? "gray" : "green"}
            loading={
              updatePlaylist.isPending &&
              updatePlaylist.variables?.playlistId === playlist.id
            }
            onClick={() =>
              updatePlaylist.mutate({
                isPublic: !playlist.is_public,
                playlistId: playlist.id,
              })
            }
            size="xs"
            variant={playlist.is_public ? "outline" : "solid"}
          >
            {playlist.is_public ? "Make private" : "Make public"}
          </Button>
          <Link to="/account/playlists">
            <Text color="blue.500" fontSize="sm">
              Back to playlists
            </Text>
          </Link>
        </HStack>
      </VStack>

      <Box
        border="1px solid"
        borderColor="gray.200"
        borderRadius="md"
        mb={4}
        p={4}
      >
        <Field.Root invalid={addError !== null}>
          <Field.Label>Add posts by ID</Field.Label>
          <HStack align="start" gap={2}>
            <Input
              onChange={(e) => {
                setPostIdsInput(e.target.value);
                setAddError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddPosts();
              }}
              placeholder="e.g. 12, 45, 67"
              value={postIdsInput}
            />
            <Button
              disabled={!postIdsInput.trim()}
              loading={addPostsMutation.isPending}
              onClick={handleAddPosts}
              size="sm"
            >
              Add posts
            </Button>
          </HStack>
          <Field.HelperText>
            Comma or space separated post IDs. Posts already in the playlist are
            skipped.
          </Field.HelperText>
          {addError && <Field.ErrorText>{addError}</Field.ErrorText>}
          {addPostsMutation.data && (
            <Text color="green.600" fontSize="xs">
              Added {addPostsMutation.data.added}, skipped{" "}
              {addPostsMutation.data.already_added} already in playlist,{" "}
              {addPostsMutation.data.not_found} not found.
            </Text>
          )}
        </Field.Root>
      </Box>

      <HStack gap={2} mb={4}>
        <Dialog.Root
          onOpenChange={(details) => {
            if (!details.open) {
              setRemoveConfirmOpen(false);
            }
          }}
          open={removeConfirmOpen}
          role="alertdialog"
        >
          <Dialog.Trigger asChild>
            <Button
              colorPalette="red"
              disabled={selectedCount === 0}
              onClick={() => setRemoveConfirmOpen(true)}
              size="xs"
              variant="outline"
            >
              Remove selected ({selectedCount})
            </Button>
          </Dialog.Trigger>
          <Portal>
            <Dialog.Backdrop />
            <Dialog.Positioner>
              <Dialog.Content>
                <Dialog.Header>
                  <Dialog.Title>Remove posts from playlist?</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body>
                  <p>
                    {selectedCount} {selectedCount === 1 ? "post" : "posts"}{" "}
                    will be removed from this playlist. You can add them back by
                    their post ID.
                  </p>
                </Dialog.Body>
                <Dialog.Footer>
                  <Dialog.ActionTrigger asChild>
                    <Button variant="outline">Cancel</Button>
                  </Dialog.ActionTrigger>
                  <Button
                    colorPalette="red"
                    loading={removePostsMutation.isPending}
                    onClick={() => {
                      removePostsMutation.mutate([...selectedPostIds]);
                      setRemoveConfirmOpen(false);
                    }}
                  >
                    Remove {selectedCount}{" "}
                    {selectedCount === 1 ? "post" : "posts"}
                  </Button>
                </Dialog.Footer>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
        {selectedCount > 0 && (
          <Button
            onClick={() => setSelectedPostIds(new Set())}
            size="xs"
            variant="ghost"
          >
            Clear selection
          </Button>
        )}
      </HStack>

      <Box display="flex" direction="column" flex={1} style={{ minHeight: 0 }}>
        {rows.length === 0 ? (
          <Box
            alignItems="center"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="md"
            display="flex"
            flex={1}
            justifyContent="center"
            style={{ minHeight: 0 }}
          >
            <Text color="gray.500">This playlist is empty</Text>
          </Box>
        ) : (
          <Box
            display="flex"
            direction="column"
            flex={1}
            style={{ minHeight: 0 }}
          >
            {hasNextPage && (
              <Text color="gray.500" fontSize="xs" mb={2}>
                Scroll to the end of the playlist to enable drag &amp; drop
                reordering.
              </Text>
            )}
            <PlaylistPostsTable
              fetchNextPage={fetchNextPage}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onReorder={(postIds) =>
                reorderPosts.mutate({ playlistId, postIds })
              }
              onSelectionChange={handleSelectionChange}
              rows={rows}
              selectedPostIds={selectedPostIds}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
