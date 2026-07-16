import {
  Badge,
  Box,
  HStack,
  Image,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { NotFound } from "src/components/NotFound";
import { assetUrl } from "src/lib/assets/url";
import { playlistsQueryUserPlaylists } from "src/lib/playlists/playlists.queries";

export const Route = createFileRoute("/users/$id/playlists/")({
  component: PlaylistsContent,
  notFoundComponent: () => <NotFound>User not found</NotFound>,
  ssr: "data-only",
});

function PlaylistsContent() {
  const { id: userId } = Route.useParams();
  const context = useRouteContext({ from: "__root__" });
  const currentUserId = context.user?.id;
  const isOwner = currentUserId === userId;

  const { data: playlists, isLoading } = useSuspenseQuery(
    playlistsQueryUserPlaylists(userId),
  );

  return (
    <Box p={4}>
      <Text fontSize="2xl" fontWeight="bold" mb={4}>
        {isOwner ? "My Playlists" : "Playlists"}
      </Text>

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
          <Text color="gray.500">
            {isOwner ? "You have no playlists yet" : "No public playlists"}
          </Text>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, lg: 4, md: 3, sm: 2, xl: 5 }} gap={4}>
          {playlists.map((playlist) => (
            <Link
              key={playlist.id}
              params={{ id: userId, playlistId: String(playlist.id) }}
              to="/users/$id/playlists/$playlistId"
            >
              <VStack cursor="pointer" gap={2} h="full">
                <Box
                  _groupHover={{ filter: "brightness(0.75)" }}
                  aspectRatio="16 / 9"
                  bg="gray.800"
                  borderRadius="lg"
                  overflow="hidden"
                  position="relative"
                  transitionDuration="200ms"
                  transitionProperty="all"
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

                <VStack align="start" flex={1} gap={1} minW={0} px={1} w="full">
                  <Text
                    _groupHover={{ color: "gray.600" }}
                    fontWeight="medium"
                    lineClamp={2}
                    transitionProperty="colors"
                  >
                    {playlist.title}
                  </Text>
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
                </VStack>
              </VStack>
            </Link>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}
