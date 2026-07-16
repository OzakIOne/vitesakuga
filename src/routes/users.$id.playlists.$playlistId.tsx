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
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { NotFound } from "src/components/NotFound";
import { Pagination } from "src/components/Pagination";
import { assetUrl } from "src/lib/assets/url";
import { playlistQueryDetail } from "src/lib/playlists/playlists.queries";
import { z } from "zod";

export const Route = createFileRoute("/users/$id/playlists/$playlistId")({
  component: PlaylistDetailContent,
  notFoundComponent: () => <NotFound>Playlist not found</NotFound>,
  validateSearch: z.object({ page: z.number().min(0).default(0) }),
  ssr: "data-only",
});

function PlaylistDetailContent() {
  const params = Route.useParams();
  const userId = params.id;
  const playlistId = z.coerce.number().parse(params.playlistId);
  const { page } = Route.useSearch();
  const navigate = useNavigate();

  const { data, isLoading } = useSuspenseQuery(
    playlistQueryDetail({ playlistId, page }),
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      void navigate({
        search: ((prev: Record<string, unknown>) => ({
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
      {isLoading && (
        <Stack align="center" justify="center" minH="600px">
          <Spinner size="lg" />
        </Stack>
      )}

      {data && (
        <>
          <VStack align="start" gap={2} mb={6}>
            <Text fontSize="2xl" fontWeight="bold">
              {data.playlist.title}
            </Text>
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
            <Box
              alignItems="center"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="md"
              display="flex"
              h="200px"
              justifyContent="center"
            >
              <Text color="gray.500">This playlist is empty</Text>
            </Box>
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
                        color="gray.500"
                        display="flex"
                        fontSize="sm"
                        justifyContent="center"
                        opacity={0.5}
                      >
                        <Text>Post deleted</Text>
                      </Box>
                    );
                  }
                  if (!item.id) return null;
                  return (
                    <Link
                      key={item.id}
                      params={{ postId: item.id }}
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
                          transitionProperty="all"
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
                              {new Date(item.created_at).toLocaleDateString()}
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
      )}
    </Box>
  );
}
