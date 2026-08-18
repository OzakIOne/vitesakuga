import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Button } from "src/components/ui/button";
import { Badge, Spinner } from "src/components/ui/feedback";
import {
  Box,
  HStack,
  SimpleGrid,
  Stack,
  VStack,
} from "src/components/ui/layout";
import { Image } from "src/components/ui/media";
import { Text } from "src/components/ui/typography";
import { assetUrl } from "src/lib/assets/url";
import { useUpdatePlaylist } from "src/lib/playlists/playlists.hooks";
import { playlistsQueryUserPlaylists } from "src/lib/playlists/playlists.queries";

export const Route = createFileRoute("/account_/playlists/")({
  component: ManagePlaylistsContent,
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

function ManagePlaylistsContent() {
  const { user } = Route.useRouteContext();
  const updatePlaylist = useUpdatePlaylist(user.id);

  const { data: playlists, isLoading } = useSuspenseQuery(
    playlistsQueryUserPlaylists(user.id),
  );

  return (
    <Box p={4}>
      <VStack align="start" gap={1} mb={6}>
        <Text fontSize="2xl" fontWeight="bold">
          My Playlists
        </Text>
        <Text color="gray.500" fontSize="sm">
          Toggle visibility or open a playlist to manage its posts.
        </Text>
      </VStack>

      {isLoading && (
        <Stack align="center" justify="center" minH="200px">
          <Spinner size="lg" />
        </Stack>
      )}

      {!isLoading && playlists.length === 0 ? (
        <Box
          alignItems="center"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
          display="flex"
          h="200px"
          justifyContent="center"
        >
          <Text color="gray.500">You have no playlists yet</Text>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, lg: 4, md: 3, sm: 2, xl: 5 }} gap={4}>
          {playlists.map((playlist) => (
            <Box
              border="1px solid"
              borderColor="gray.200"
              borderRadius="lg"
              key={playlist.id}
              overflow="hidden"
            >
              <Link
                params={{ playlistId: String(playlist.id) }}
                to="/account/playlists/$playlistId"
              >
                <Box
                  aspectRatio="16 / 9"
                  bg="gray.800"
                  cursor="pointer"
                  overflow="hidden"
                  position="relative"
                  w="full"
                >
                  {playlist.thumbnail_key ? (
                    <Image
                      alt={playlist.title}
                      h="full"
                      objectFit="contain"
                      src={assetUrl(playlist.thumbnail_key)}
                      w="full"
                    />
                  ) : (
                    <Box
                      alignItems="center"
                      display="flex"
                      h="full"
                      justifyContent="center"
                      w="full"
                    >
                      <Text color="gray.500" fontSize="lg">
                        No posts
                      </Text>
                    </Box>
                  )}
                </Box>
              </Link>

              <VStack align="start" gap={2} p={3}>
                <Link
                  params={{ playlistId: String(playlist.id) }}
                  to="/account/playlists/$playlistId"
                >
                  <Text fontWeight="medium" lineClamp={2}>
                    {playlist.title}
                  </Text>
                </Link>

                <HStack gap={2}>
                  <Text color="gray.500" fontSize="xs">
                    {playlist.post_count} post
                    {playlist.post_count !== 1 ? "s" : ""}
                  </Text>
                  <Badge
                    borderRadius="full"
                    colorPalette={playlist.is_public ? "green" : "gray"}
                    px={2}
                    size="xs"
                  >
                    {playlist.is_public ? "Public" : "Private"}
                  </Badge>
                </HStack>

                <HStack gap={2}>
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
                  <Button asChild size="xs" variant="ghost">
                    <Link
                      params={{ playlistId: String(playlist.id) }}
                      to="/account/playlists/$playlistId"
                    >
                      Manage
                    </Link>
                  </Button>
                </HStack>
              </VStack>
            </Box>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}
