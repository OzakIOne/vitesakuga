import { Link } from "@tanstack/react-router";
import { assetUrl } from "src/lib/assets/url";
import { PROMOTION_RULES } from "src/lib/promotions/promotions.config";
import type { ContributorProfile as ContributorProfileData } from "src/lib/users/users.schema";
import { formatDateUtc } from "src/utils/date-format";

import { Badge } from "./ui/feedback";
import { Box, HStack, SimpleGrid, Stack, VStack } from "./ui/layout";
import { Avatar, Card, Image } from "./ui/media";
import { Heading, Text } from "./ui/typography";

type ContributorProfileProps = {
  profile: ContributorProfileData;
};

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <Stack gap={0}>
      <Text fontSize="xl" fontWeight="bold">
        {value}
      </Text>
      <Text color="gray.500" fontSize="sm">
        {label}
      </Text>
    </Stack>
  );
}

export function ContributorProfile({ profile }: ContributorProfileProps) {
  const isNovice = profile.role === "novice";
  const pointsProgress = isNovice
    ? Math.min(100, (profile.points / PROMOTION_RULES.minPoints) * 100)
    : null;
  const pointsRemaining = isNovice
    ? Math.max(0, PROMOTION_RULES.minPoints - profile.points)
    : null;

  return (
    <Card.Root mb={4}>
      <Card.Body>
        <HStack align="start" gap={4}>
          <Avatar.Root size="xl">
            {profile.image && <Avatar.Image src={profile.image} />}
            <Avatar.Fallback name={profile.name} />
          </Avatar.Root>
          <Stack flex={1} gap={1} minW={0}>
            <Heading as="h1" size="2xl">
              {profile.name}
            </Heading>
            <Text color="gray.500">
              @{profile.username} · Member since{" "}
              {formatDateUtc(profile.createdAt)}
            </Text>
            {profile.badges.length > 0 && (
              <HStack gap={2} mt={2} wrap="wrap">
                {profile.badges.map((badge) => (
                  <Badge colorPalette={badge.color} key={badge.id}>
                    {badge.label}
                  </Badge>
                ))}
              </HStack>
            )}
          </Stack>
        </HStack>

        <SimpleGrid columns={{ base: 2, sm: 3, lg: 5 }} gap={4} mt={6}>
          <ProfileStat label="Posts" value={profile.posts} />
          <ProfileStat label="Comments" value={profile.comments} />
          <ProfileStat label="Likes received" value={profile.likesReceived} />
          <ProfileStat label="Accepted edits" value={profile.acceptedEdits} />
          <ProfileStat
            label="Public playlists"
            value={profile.publicPlaylistCount}
          />
        </SimpleGrid>

        <Box borderColor="gray.200" borderTop="1px solid" mt={6} pt={4}>
          <HStack align="start" justify="space-between" wrap="wrap">
            <Stack gap={0}>
              <Text fontWeight="semibold">
                {profile.points} activity points
              </Text>
              <Text color="gray.500" fontSize="sm">
                Points reflect participation, not content quality.
              </Text>
            </Stack>
            {pointsRemaining !== null && (
              <Text color="gray.500" fontSize="sm">
                {pointsRemaining > 0
                  ? `${pointsRemaining} to the uploader review threshold`
                  : "Points threshold reached; account age and review still apply"}
              </Text>
            )}
          </HStack>
          {pointsProgress !== null && (
            <progress
              aria-label="Progress toward the uploader review points threshold"
              className="mt-3 h-2 w-full"
              max={100}
              value={pointsProgress}
            />
          )}
        </Box>

        {profile.publicPlaylists.length > 0 && (
          <Box borderColor="gray.200" borderTop="1px solid" mt={6} pt={4}>
            <HStack justify="space-between" mb={3}>
              <Heading as="h2" size="lg">
                Curated playlists
              </Heading>
              <Link params={{ id: profile.id }} to="/users/$id/playlists">
                View all
              </Link>
            </HStack>
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={3}>
              {profile.publicPlaylists.map((playlist) => (
                <Link
                  key={playlist.id}
                  params={{
                    id: profile.id,
                    playlistId: String(playlist.id),
                  }}
                  to="/users/$id/playlists/$playlistId"
                >
                  <Card.Root h="full">
                    {playlist.thumbnailKey ? (
                      <Image
                        alt=""
                        aspectRatio="16 / 9"
                        objectFit="contain"
                        src={assetUrl(playlist.thumbnailKey)}
                        w="full"
                      />
                    ) : (
                      <Box
                        alignItems="center"
                        aspectRatio="16 / 9"
                        bg="gray.800"
                        display="flex"
                        justifyContent="center"
                      >
                        <Text color="gray.300" fontSize="sm">
                          No posts
                        </Text>
                      </Box>
                    )}
                    <Card.Body>
                      <VStack align="start" gap={1}>
                        <Text fontWeight="semibold" lineClamp={2}>
                          {playlist.title}
                        </Text>
                        <Text color="gray.500" fontSize="sm">
                          {playlist.postCount} post
                          {playlist.postCount === 1 ? "" : "s"}
                        </Text>
                      </VStack>
                    </Card.Body>
                  </Card.Root>
                </Link>
              ))}
            </SimpleGrid>
          </Box>
        )}
      </Card.Body>
    </Card.Root>
  );
}
