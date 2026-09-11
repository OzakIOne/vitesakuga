import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { EmptyState } from "src/components/EmptyState";
import { NotFound } from "src/components/NotFound";
import { Button } from "src/components/ui/button";
import { Badge } from "src/components/ui/feedback";
import { Box, HStack, SimpleGrid, VStack } from "src/components/ui/layout";
import { Image } from "src/components/ui/media";
import { Heading, Text } from "src/components/ui/typography";
import { assetUrl } from "src/lib/assets/url";
import { playlistsQueryUserPlaylists } from "src/lib/playlists/playlists.queries";
import { rethrowRouteDataError } from "src/lib/router/not-found";
import { contributorProfileQueryOptions } from "src/lib/users/users.queries";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/users/$id/playlists/")({
  component: PlaylistsContent,
  loader: async ({ context, params }) => {
    try {
      const [profile] = await Promise.all([
        context.queryClient.query({
          ...contributorProfileQueryOptions(params.id),
          staleTime: "static",
        }),
        context.queryClient.query({
          ...playlistsQueryUserPlaylists(params.id),
          staleTime: "static",
        }),
      ]);
      return profile;
    } catch (error) {
      rethrowRouteDataError(error);
    }
  },
  notFoundComponent: () => <NotFound>User not found</NotFound>,
  head: ({ loaderData }) => ({
    meta: seo({
      description: loaderData
        ? `Browse public playlists curated by ${loaderData.name} on ViteSakuga.`
        : "Public contributor playlists on ViteSakuga.",
      title: loaderData
        ? `${loaderData.name}'s playlists · ViteSakuga`
        : "Contributor playlists · ViteSakuga",
    }),
  }),
});

function PlaylistsContent() {
  const { id: userId } = Route.useParams();
  const context = useRouteContext({ from: "__root__" });
  const currentUserId = context.user?.id;
  const isOwner = currentUserId === userId;

  const { data: playlists } = useSuspenseQuery(
    playlistsQueryUserPlaylists(userId),
  );

  return (
    <Box p={4}>
      <HStack align="center" justify="space-between" mb={4}>
        <Heading as="h1" size="2xl">
          {isOwner ? "My Playlists" : "Playlists"}
        </Heading>
        {isOwner && (
          <Button asChild size="xs" variant="outline">
            <Link to="/account/playlists">Manage</Link>
          </Button>
        )}
      </HStack>

      {playlists.length === 0 ? (
        <EmptyState
          description={
            isOwner
              ? "Create a playlist to organize your favorite posts."
              : "This contributor has not published any playlists."
          }
          title={isOwner ? "You have no playlists yet" : "No public playlists"}
        />
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
                  transitionProperty="filter"
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
                      <EmptyState
                        description="Add posts to this playlist to see them here."
                        size="compact"
                        title="No posts"
                        titleAs="p"
                      />
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
