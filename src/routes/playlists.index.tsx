import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { useCallback } from "react";
import { Pagination } from "src/components/Pagination";
import { Spinner } from "src/components/ui/feedback";
import {
  Box,
  HStack,
  SimpleGrid,
  Stack,
  VStack,
} from "src/components/ui/layout";
import { Image } from "src/components/ui/media";
import { Heading, Text } from "src/components/ui/typography";
import { assetUrl } from "src/lib/assets/url";
import { publicPlaylistsQueryOptions } from "src/lib/playlists/playlists.queries";

const PlaylistsSearchSchema = Schema.Struct({
  page: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    Schema.withDecodingDefault(Effect.succeed(0)),
  ),
});

export const Route = createFileRoute("/playlists/")({
  component: PlaylistsContent,
  validateSearch: Schema.toStandardSchemaV1(PlaylistsSearchSchema),
  ssr: "data-only",
});

function PlaylistsContent() {
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { data, isLoading } = useSuspenseQuery(
    publicPlaylistsQueryOptions({ page }),
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      void navigate({
        replace: true,
        resetScroll: false,
        search: (prev) => ({ ...prev, page: newPage }),
      });
      window.scrollTo({ behavior: "smooth", top: 0 });
    },
    [navigate],
  );

  return (
    <Box p={4} w="full">
      <Heading as="h1" mb={4} size="2xl">
        Public Playlists
      </Heading>

      {isLoading && (
        <Stack align="center" justify="center" minH="200px">
          <Spinner size="lg" />
        </Stack>
      )}

      {!isLoading && data.data.length === 0 ? (
        <Box
          alignItems="center"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
          display="flex"
          h="200px"
          justifyContent="center"
        >
          <Text color="gray.500">No public playlists yet</Text>
        </Box>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, lg: 4, md: 3, sm: 2, xl: 5 }} gap={4}>
            {data.data.map((playlist) => (
              <Link
                key={playlist.id}
                params={{
                  id: playlist.user_id,
                  playlistId: String(playlist.id),
                }}
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
                        <Text color="gray.500" fontSize="lg">
                          No posts
                        </Text>
                      </Box>
                    )}
                  </Box>

                  <VStack
                    align="start"
                    flex={1}
                    gap={1}
                    minW={0}
                    px={1}
                    w="full"
                  >
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
                      <Text color="gray.500" fontSize="xs">
                        by {playlist.user_name}
                      </Text>
                    </HStack>
                  </VStack>
                </VStack>
              </Link>
            ))}
          </SimpleGrid>
          <Pagination
            currentPage={page}
            onPageChange={handlePageChange}
            totalPages={data.meta.pagination.totalPages}
          />
        </>
      )}
    </Box>
  );
}
