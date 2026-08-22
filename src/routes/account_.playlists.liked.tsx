import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { useCallback } from "react";
import { Pagination } from "src/components/Pagination";
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
import { votesQueryLikedPosts } from "src/lib/votes/votes.queries";

const LikedSearchSchema = Schema.Struct({
  page: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    Schema.withDecodingDefault(Effect.succeed(0)),
  ),
});

export const Route = createFileRoute("/account_/playlists/liked")({
  component: LikedPostsContent,
  validateSearch: Schema.toStandardSchemaV1(LikedSearchSchema),
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

function LikedPostsContent() {
  const { page } = Route.useSearch();
  const navigate = useNavigate();

  const { data, isLoading } = useSuspenseQuery(votesQueryLikedPosts({ page }));

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
      {isLoading && (
        <Stack align="center" justify="center" minH="600px">
          <Spinner size="lg" />
        </Stack>
      )}

      {data && (
        <>
          <VStack align="start" gap={2} mb={6}>
            <Text fontSize="2xl" fontWeight="bold">
              Liked posts
            </Text>
            <HStack gap={4}>
              <Text color="gray.500" fontSize="sm">
                {data.playlist.post_count} post
                {data.playlist.post_count !== 1 ? "s" : ""}
              </Text>
              <Badge borderRadius="full" colorPalette="gray" px={2} size="sm">
                Private
              </Badge>
              <Link to="/account/playlists">
                <Text color="blue.500" fontSize="sm">
                  Back to my playlists
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
              <Text color="gray.500">Posts you like will show up here</Text>
            </Box>
          ) : (
            <>
              <SimpleGrid
                columns={{ base: 1, lg: 4, md: 3, sm: 2, xl: 5 }}
                gap={4}
                mb={8}
              >
                {data.data.map((item) => (
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
                            alt={item.title}
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
                        <Text color="gray.500" fontSize="xs">
                          Liked{" "}
                          {new Date(item.added_at).toLocaleDateString("en-US", {
                            timeZone: "UTC",
                          })}
                        </Text>
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
        </>
      )}
    </Box>
  );
}
