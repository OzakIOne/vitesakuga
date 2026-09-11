import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { useCallback } from "react";
import { EmptyState } from "src/components/EmptyState";
import { NotFound } from "src/components/NotFound";
import { Pagination } from "src/components/Pagination";
import { Badge } from "src/components/ui/feedback";
import { Box, HStack, SimpleGrid, VStack } from "src/components/ui/layout";
import { Image } from "src/components/ui/media";
import { Heading, Text } from "src/components/ui/typography";
import { assetUrl } from "src/lib/assets/url";
import { asPlaylistId } from "src/lib/ids";
import { playlistQueryDetail } from "src/lib/playlists/playlists.queries";
import { rethrowRouteDataError } from "src/lib/router/not-found";
import { parsePositiveIntegerRouteParam } from "src/lib/router/route-params";
import { formatDateUtc } from "src/utils/date-format";
import { seo } from "src/utils/seo";

const PlaylistSearchSchema = Schema.Struct({
  page: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    Schema.withDecodingDefault(Effect.succeed(0)),
  ),
});

export const Route = createFileRoute("/users/$id/playlists/$playlistId")({
  component: PlaylistDetailContent,
  validateSearch: Schema.toStandardSchemaV1(PlaylistSearchSchema),
  loader: async ({ context, params }) => {
    const playlistId = asPlaylistId(
      parsePositiveIntegerRouteParam(params.playlistId),
    );
    try {
      return await context.queryClient.query({
        ...playlistQueryDetail({ page: 0, playlistId }),
        staleTime: "static",
      });
    } catch (error) {
      rethrowRouteDataError(error);
    }
  },
  notFoundComponent: () => <NotFound>Playlist not found</NotFound>,
  head: ({ loaderData }) => ({
    meta: seo({
      description:
        loaderData?.playlist.description ||
        "Browse a public contributor playlist on ViteSakuga.",
      title: loaderData
        ? `${loaderData.playlist.title} · ViteSakuga`
        : "Public playlist · ViteSakuga",
    }),
  }),
});

function PlaylistDetailContent() {
  const params = Route.useParams();
  const userId = params.id;
  // Route param is untrusted here; the playlist-detail server fn re-validates.
  const playlistId = asPlaylistId(
    parsePositiveIntegerRouteParam(params.playlistId),
  );
  const { page } = Route.useSearch();
  const navigate = useNavigate();

  const { data } = useSuspenseQuery(playlistQueryDetail({ playlistId, page }));

  const handlePageChange = useCallback(
    (newPage: number) => {
      void navigate({
        // SAFETY: TanStack Router's navigate search updater resolves to
        // `never` for this "data-only" route; at runtime the updater still
        // receives the full search params and the spread preserves them.
        search: ((prev: { page?: number }) => ({
          ...prev,
          page: newPage,
        })) as never,
      });
      window.scrollTo({ behavior: "smooth", top: 0 });
    },
    [navigate],
  );

  return (
    <Box p={4}>
      <>
        <VStack align="start" gap={2} mb={6}>
          <Heading as="h1" size="2xl">
            {data.playlist.title}
          </Heading>
          {data.playlist.description && (
            <Text color="gray.500">{data.playlist.description}</Text>
          )}
          <HStack gap={4}>
            <Text color="gray.500" fontSize="sm">
              {data.playlist.post_count} post
              {data.playlist.post_count !== 1 ? "s" : ""}
            </Text>
            <Badge
              borderRadius="full"
              colorPalette={data.playlist.is_public ? "green" : "gray"}
              px={2}
              size="sm"
            >
              {data.playlist.is_public ? "Public" : "Private"}
            </Badge>
            <Link params={{ id: userId }} to="/users/$id/playlists">
              <Text color="blue.500" fontSize="sm">
                Back to playlists
              </Text>
            </Link>
          </HStack>
        </VStack>

        {data.data.length === 0 ? (
          <EmptyState
            description="Add posts to this playlist to see them here."
            title="This playlist is empty"
          />
        ) : (
          <>
            <SimpleGrid
              columns={{ base: 1, lg: 4, md: 3, sm: 2, xl: 5 }}
              gap={4}
              mb={8}
            >
              {data.data.map((item) => {
                if ("orphan" in item) {
                  return (
                    <Box
                      key={`orphan-${item.post_id}`}
                      alignItems="center"
                      aspectRatio="16 / 9"
                      bg="gray.800"
                      borderRadius="lg"
                      color="gray.300"
                      display="flex"
                      fontSize="sm"
                      justifyContent="center"
                    >
                      <Text>Post deleted</Text>
                    </Box>
                  );
                }
                if (!item.id) return null;
                return (
                  <Link
                    key={item.id}
                    params={{ postId: String(item.id) }}
                    to="/posts/$postId"
                  >
                    <VStack cursor="pointer" gap={2} h="full">
                      <Box
                        _groupHover={{
                          filter: "brightness(0.75)",
                        }}
                        aspectRatio="16 / 9"
                        bg="gray.900"
                        borderRadius="lg"
                        overflow="hidden"
                        position="relative"
                        transitionDuration="200ms"
                        transitionProperty="filter"
                        w="full"
                      >
                        {item.thumbnail_key && (
                          <Image
                            alt={item.title ?? ""}
                            h="full"
                            objectFit="contain"
                            src={assetUrl(item.thumbnail_key)}
                            w="full"
                          />
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
                          {item.title}
                        </Text>
                        {item.created_at && (
                          <Text color="gray.500" fontSize="xs">
                            {formatDateUtc(item.created_at)}
                          </Text>
                        )}
                      </VStack>
                    </VStack>
                  </Link>
                );
              })}
            </SimpleGrid>
            <Pagination
              currentPage={page}
              onPageChange={handlePageChange}
              totalPages={data.meta.pagination.totalPages}
            />
          </>
        )}
      </>
    </Box>
  );
}
