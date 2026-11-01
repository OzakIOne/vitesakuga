import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import { usePlaylistsFns } from "./playlists.fn-context";
import { playlistsKeys } from "./playlists.queries";
import type { PlaylistDetailPage, PlaylistsForPost } from "./playlists.queries";

const invalidatePlaylistQueries = (
  queryClient: QueryClient,
  queryKeys: readonly (readonly unknown[])[],
) => {
  for (const queryKey of queryKeys) {
    void queryClient.invalidateQueries({ queryKey });
  }
};

/** The queries that render a playlist's title, thumbnail, or visibility. */
const playlistSummaryKeys = ({
  playlistId,
  userId,
}: {
  playlistId: number;
  userId: string;
}) => [
  playlistsKeys.detailForPlaylist(playlistId),
  playlistsKeys.userPlaylists(userId),
  playlistsKeys.publicLists,
];

export function useUpdatePlaylist(userId: string) {
  const queryClient = useQueryClient();
  const { updatePlaylist } = usePlaylistsFns();

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
      // Post checklists read the whole playlist row, so any field change reaches them.
      invalidatePlaylistQueries(queryClient, [
        ...playlistSummaryKeys({
          playlistId: variables.playlistId,
          userId,
        }),
        playlistsKeys.postMemberships,
      ]);
    },
    successDescription: "Your playlist has been updated.",
    successTitle: "Playlist updated",
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
export function useReorderPlaylistPosts(userId: string) {
  const queryClient = useQueryClient();
  const { reorderPlaylistPosts } = usePlaylistsFns();

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
      invalidatePlaylistQueries(
        queryClient,
        playlistSummaryKeys({ playlistId, userId }),
      );
    },
    successDescription: "The playlist order has been updated.",
    successTitle: "Playlist reordered",
  });
}

const invalidatePlaylistMembershipQueries = (
  queryClient: QueryClient,
  {
    playlistId,
    postIds,
    userId,
  }: { playlistId: number; postIds: number[]; userId: string },
) => {
  invalidatePlaylistQueries(
    queryClient,
    playlistSummaryKeys({ playlistId, userId }),
  );
  for (const postId of postIds) {
    void queryClient.invalidateQueries({
      queryKey: playlistsKeys.forPost(postId),
    });
  }
};

/**
 * Checks or unchecks one playlist for a post. The checkbox state is applied
 * optimistically; every settle refetches the post's playlist list so a failed
 * change shows the server's state.
 */
export function useSetPostPlaylistMembership({
  postId,
  userId,
}: {
  postId: number;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const { addPostToPlaylist, removePostFromPlaylist } = usePlaylistsFns();

  return useMutation({
    mutationFn: async ({
      contains,
      playlistId,
    }: {
      playlistId: number;
      contains: boolean;
    }) =>
      contains
        ? addPostToPlaylist({ data: { playlistId, postId } })
        : removePostFromPlaylist({ data: { playlistId, postId } }),
    onMutate: ({ contains, playlistId }) => {
      queryClient.setQueryData<PlaylistsForPost>(
        playlistsKeys.forPost(postId),
        (old) =>
          old?.map((playlist) =>
            playlist.id === playlistId
              ? { ...playlist, contains_post: contains }
              : playlist,
          ),
      );
    },
    onSettled: (_data, _error, { playlistId }) => {
      invalidatePlaylistMembershipQueries(queryClient, {
        playlistId,
        postIds: [postId],
        userId,
      });
    },
  });
}

/** Creates a private playlist from the add-to-playlist dialog. */
export function useCreatePlaylistForPost({
  postId,
  userId,
}: {
  postId: number;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const { createPlaylist } = usePlaylistsFns();

  return useMutation({
    mutationFn: async (title: string) =>
      createPlaylist({ data: { isPublic: false, title } }),
    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.forPost(postId),
      });
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.userPlaylists(userId),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: playlistsKeys.userPlaylists(userId),
      });
    },
  });
}

export function useBulkAddPostsToPlaylist({
  playlistId,
  userId,
}: {
  playlistId: number;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const { bulkAddPostsToPlaylist } = usePlaylistsFns();

  return useMutationWithFeedback({
    errorFallback: "Failed to add posts to the playlist",
    errorTitle: "Error adding posts",
    mutationFn: async (postIds: number[]) =>
      bulkAddPostsToPlaylist({ data: { playlistId, postIds } }),
    onSuccess: (_, postIds) => {
      invalidatePlaylistMembershipQueries(queryClient, {
        playlistId,
        postIds,
        userId,
      });
    },
    successTitle: "Posts added",
  });
}

export function useBulkRemovePostsFromPlaylist({
  playlistId,
  userId,
}: {
  playlistId: number;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const { bulkRemovePostsFromPlaylist } = usePlaylistsFns();

  return useMutationWithFeedback({
    errorFallback: "Failed to remove posts from the playlist",
    errorTitle: "Error removing posts",
    mutationFn: async (postIds: number[]) =>
      bulkRemovePostsFromPlaylist({ data: { playlistId, postIds } }),
    onSuccess: (_, postIds) => {
      invalidatePlaylistMembershipQueries(queryClient, {
        playlistId,
        postIds,
        userId,
      });
    },
    successTitle: "Posts removed",
  });
}
