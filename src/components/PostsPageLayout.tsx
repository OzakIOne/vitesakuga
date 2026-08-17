import { Portal } from "@ark-ui/react";
import type { RegisteredRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "src/components/ui/button";
import { Badge, DataList } from "src/components/ui/feedback";
import { Box, Grid, GridItem, VStack, Wrap } from "src/components/ui/layout";
import {
  Collapsible,
  Popover,
  useCollapsibleContext,
} from "src/components/ui/overlay";
import { Heading, Text } from "src/components/ui/typography";
import type {
  PostsSearchParams,
  VideoMetadata,
} from "src/lib/posts/posts.schema";

import { PopularTagsSection } from "./PopularTagsSection";
import type { PopularTag } from "./PopularTagsSection";
import { PostFilters } from "./PostFilters";
import { SearchBox } from "./SearchBox";

type RegisteredRoutes =
  RegisteredRouter["routesByPath"][keyof RegisteredRouter["routesByPath"]]["fullPath"];

const EMPTY_SELECTED_TAGS: readonly string[] = [];

export type PostsPageLayoutProps = {
  searchQuery?: string | undefined;
  selectedTags?: readonly string[] | undefined;
  popularTags: PopularTag[];
  sortBy: PostsSearchParams["sortBy"];
  dateRange: PostsSearchParams["dateRange"];
  children: ReactNode;
  fromRoute: RegisteredRoutes;
  videoMetadata?: VideoMetadata | undefined;
};

function CollapseArrow() {
  const ctx = useCollapsibleContext();
  return (
    <Text
      as="span"
      display="inline-block"
      mr={1}
      transform={ctx.open ? "rotate(90deg)" : "rotate(0deg)"}
      transition="transform 0.2s"
    >
      ▶
    </Text>
  );
}

export function PostsPageLayout({
  searchQuery,
  selectedTags = EMPTY_SELECTED_TAGS,
  popularTags,
  sortBy,
  dateRange,
  children,
  fromRoute,
  videoMetadata,
}: PostsPageLayoutProps) {
  const isPostDetail = fromRoute === "/posts/$postId";

  const sidebarCards = (
    <>
      {selectedTags.length > 0 && (
        <Box border="1px" borderRadius="md" p={4} shadow="md">
          <Heading mb={3} size="sm">
            Active Filters
          </Heading>
          <Wrap gap={2}>
            {selectedTags.map((tag) => (
              <Badge colorScheme="blue" key={tag}>
                {tag}
              </Badge>
            ))}
          </Wrap>
        </Box>
      )}

      {popularTags.length > 0 && (
        <Box border="1px" borderRadius="md" p={4} shadow="md">
          <PopularTagsSection tags={popularTags} />
        </Box>
      )}

      {!isPostDetail && (
        <Box border="1px" borderRadius="md" p={4} shadow="md">
          <Heading mb={3} size="sm">
            Filters
          </Heading>
          <PostFilters
            dateRange={dateRange}
            fromRoute={fromRoute}
            sortBy={sortBy}
          />
        </Box>
      )}
    </>
  );

  const hasCollapsibleSidebarCards =
    selectedTags.length > 0 || popularTags.length > 0 || !isPostDetail;

  return (
    <Box className="p-3 lg:p-4" w="full">
      <Grid
        className="grid-cols-1 gap-3 lg:grid-cols-[1fr_3fr] lg:gap-6"
        w="full"
      >
        <GridItem>
          <VStack align="stretch" className="lg:gap-4" gap={3}>
            <Box border="1px" borderRadius="md" p={4} shadow="md">
              <SearchBox
                defaultTags={selectedTags}
                defaultValue={searchQuery}
              />
            </Box>

            {hasCollapsibleSidebarCards && (
              <>
                <Box className="lg:hidden">
                  <Collapsible.Root defaultOpen={false}>
                    <Box border="1px" borderRadius="md" p={3} shadow="md">
                      <Collapsible.Trigger className="flex w-full cursor-pointer items-center justify-between">
                        <Text fontSize="sm" fontWeight="bold">
                          Filters & Popular Tags
                          {selectedTags.length > 0 && (
                            <Badge
                              className="ms-2"
                              colorScheme="blue"
                              size="xs"
                            >
                              {selectedTags.length} active
                            </Badge>
                          )}
                        </Text>
                        <CollapseArrow />
                      </Collapsible.Trigger>
                    </Box>
                    <Collapsible.Content>
                      <VStack align="stretch" gap={3}>
                        {sidebarCards}
                      </VStack>
                    </Collapsible.Content>
                  </Collapsible.Root>
                </Box>

                <Box className="hidden lg:block">
                  <VStack align="stretch" gap={4}>
                    {sidebarCards}
                  </VStack>
                </Box>
              </>
            )}

            {videoMetadata && (
              <Collapsible.Root defaultOpen={false}>
                <Box border="1px" borderRadius="md" p={4} shadow="md">
                  <Heading mb={3} size="sm">
                    <Collapsible.Trigger cursor="pointer">
                      <CollapseArrow />
                      Video Metadata
                    </Collapsible.Trigger>
                  </Heading>
                  <Collapsible.Content>
                    <VStack align="stretch" fontSize="xs" gap={1}>
                      <DataList.Root orientation="horizontal">
                        {Object.entries(videoMetadata).map(([key, value]) => (
                          <DataList.Item key={key}>
                            <DataList.ItemLabel>{key}</DataList.ItemLabel>
                            <DataList.ItemValue>
                              {key === "Encoded_Library_Settings" ? (
                                <Popover.Root>
                                  <Popover.Trigger asChild>
                                    <Button size="xs" variant="outline">
                                      View Settings
                                    </Button>
                                  </Popover.Trigger>
                                  <Portal>
                                    <Popover.Positioner>
                                      <Popover.Content maxW="sm">
                                        <Popover.Arrow />
                                        <Popover.Body>
                                          <Text className="max-h-48 overflow-y-auto break-words whitespace-pre-wrap">
                                            {value}
                                          </Text>
                                        </Popover.Body>
                                      </Popover.Content>
                                    </Popover.Positioner>
                                  </Portal>
                                </Popover.Root>
                              ) : (
                                value
                              )}
                            </DataList.ItemValue>
                          </DataList.Item>
                        ))}
                      </DataList.Root>
                    </VStack>
                  </Collapsible.Content>
                </Box>
              </Collapsible.Root>
            )}
          </VStack>
        </GridItem>

        <GridItem>{children}</GridItem>
      </Grid>
    </Box>
  );
}
