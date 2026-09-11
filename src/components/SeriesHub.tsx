import { Link } from "@tanstack/react-router";
import type { fetchSeriesHub } from "src/lib/posts/posts.service";
import {
  buildSeriesArchive,
  formatSeriesPosition,
  type SeriesArchiveGroup,
  type SeriesNavigation,
} from "src/lib/posts/series-hubs";

import { EmptyState } from "./EmptyState";
import { PostCard } from "./PostCard";
import { Badge } from "./ui/feedback";
import { Box, Grid, HStack, Stack, VStack } from "./ui/layout";
import { Heading, Text } from "./ui/typography";

type SeriesHubData = Awaited<ReturnType<typeof fetchSeriesHub>>;

type SeriesHubProps = {
  readonly data: SeriesHubData;
};

type SeriesPostGridProps = {
  readonly posts: SeriesArchiveGroup["posts"];
};

function SeriesPostGrid({ posts }: SeriesPostGridProps) {
  return (
    <Grid className="grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </Grid>
  );
}

function GroupedPosts({
  groups,
  heading,
}: {
  readonly groups: readonly SeriesArchiveGroup[];
  readonly heading: string;
}) {
  if (groups.length === 0) return null;

  return (
    <Stack align="stretch" gap={4}>
      <Heading as="h2" size="lg">
        {heading}
      </Heading>
      {groups.map((group) => (
        <Box border="1px" borderRadius="md" key={group.key} p={4}>
          <Heading as="h3" mb={3} size="sm">
            {group.label}
          </Heading>
          <SeriesPostGrid posts={group.posts} />
        </Box>
      ))}
    </Stack>
  );
}

export function SeriesHub({ data }: SeriesHubProps) {
  const archive = buildSeriesArchive(data.posts);

  return (
    <VStack align="stretch" gap={6}>
      <Box border="1px" borderRadius="md" p={5} shadow="sm">
        <Heading as="h1" className="break-words" size="2xl">
          {data.title}
        </Heading>
        <Text color="gray.600" mt={2}>
          {data.posts.length} {data.posts.length === 1 ? "post" : "posts"} in
          this archive.
        </Text>
        <HStack flexWrap="wrap" gap={2} mt={4}>
          <Badge colorScheme="green">{archive.completeCount} sequenced</Badge>
          {archive.incompleteCount > 0 && (
            <Badge colorScheme="orange">
              {archive.incompleteCount} incomplete
            </Badge>
          )}
          {archive.conflictingCount > 0 && (
            <Badge colorScheme="red">
              {archive.conflictingCount} conflicting
            </Badge>
          )}
        </HStack>
        <Link
          className="mt-4 inline-block text-sm text-blue-600 hover:underline"
          search={{
            dateRange: "all",
            page: 0,
            q: "",
            seriesTitle: data.title,
            sortBy: "newest",
            tags: [],
          }}
          to="/posts"
        >
          Browse this series in the post feed
        </Link>
      </Box>

      <GroupedPosts groups={archive.episodeGroups} heading="Episodes" />
      <GroupedPosts groups={archive.chapterGroups} heading="Chapters" />

      {archive.moviePosts.length > 0 && (
        <Stack align="stretch" gap={3}>
          <Heading as="h2" size="lg">
            Movies
          </Heading>
          <SeriesPostGrid posts={archive.moviePosts} />
        </Stack>
      )}

      {archive.reviewItems.length > 0 && (
        <Stack align="stretch" gap={4}>
          <Box>
            <Heading as="h2" size="lg">
              Needs metadata review
            </Heading>
            <Text color="gray.600" mt={1}>
              These posts stay visible, but cannot be placed reliably in the
              episode or chapter sequence yet.
            </Text>
          </Box>
          <Grid className="grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {archive.reviewItems.map(({ metadata, post }) => (
              <Box
                border="1px"
                borderColor="orange.300"
                borderRadius="md"
                key={post.id}
                p={3}
              >
                <PostCard post={post} />
                <Text color="orange.700" fontSize="sm" mt={3}>
                  {metadata.status === "conflicting"
                    ? "Conflicting metadata: "
                    : "Incomplete metadata: "}
                  {metadata.issues.join(" ")}
                </Text>
              </Box>
            ))}
          </Grid>
        </Stack>
      )}

      {data.posts.length === 0 && (
        <EmptyState
          description="No posts have been filed under this series yet."
          title="No posts in this series"
        />
      )}
    </VStack>
  );
}

export function MoreFromSeriesPanel({
  currentPostId,
  posts,
  title,
}: {
  readonly currentPostId: number;
  readonly posts: SeriesHubData["posts"] | undefined;
  readonly title: string | null;
}) {
  if (!posts || !title) return null;

  const morePosts = [...posts]
    .filter((post) => Number(post.id) !== currentPostId)
    .reverse()
    .slice(0, 6);
  if (morePosts.length === 0) return null;

  return (
    <Box border="1px" borderRadius="md" p={4} shadow="sm">
      <HStack justify="space-between" mb={4}>
        <Heading as="h2" size="lg">
          More from this series
        </Heading>
        <Link
          className="text-sm text-blue-600 hover:underline"
          params={{ seriesTitle: title }}
          to="/series/$seriesTitle"
        >
          View archive
        </Link>
      </HStack>
      <SeriesPostGrid posts={morePosts} />
    </Box>
  );
}

export function SeriesNavigationPanel({
  navigation,
}: {
  readonly navigation: SeriesNavigation | null;
}) {
  if (!navigation) return null;

  return (
    <Box border="1px" borderRadius="md" p={4} shadow="sm">
      <Heading as="h2" mb={3} size="sm">
        Continue the sequence
      </Heading>
      {navigation.reason ? (
        <Text color="orange.700" fontSize="sm">
          Navigation is unavailable for this post: {navigation.reason}
        </Text>
      ) : (
        <HStack flexWrap="wrap" justify="space-between" gap={3}>
          {navigation.previous ? (
            <Link
              className="text-blue-600 hover:underline"
              params={{ postId: String(navigation.previous.id) }}
              to="/posts/$postId"
            >
              ← {formatSeriesPosition(navigation.previous) ?? "Previous post"}
            </Link>
          ) : (
            <Text color="gray.500" fontSize="sm">
              Start of sequence
            </Text>
          )}
          {navigation.next ? (
            <Link
              className="text-blue-600 hover:underline"
              params={{ postId: String(navigation.next.id) }}
              to="/posts/$postId"
            >
              {formatSeriesPosition(navigation.next) ?? "Next post"} →
            </Link>
          ) : (
            <Text color="gray.500" fontSize="sm">
              End of sequence
            </Text>
          )}
        </HStack>
      )}
    </Box>
  );
}
