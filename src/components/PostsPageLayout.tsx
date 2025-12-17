import {
  Badge,
  Box,
  Grid,
  GridItem,
  Heading,
  VStack,
  Wrap,
} from "@chakra-ui/react";
import type { RegisteredRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { PostSearchParams } from "src/lib/posts/posts.schema";
import { type PopularTag, PopularTagsSection } from "./PopularTagsSection";
import { PostFilters } from "./PostFilters";
import { SearchBox } from "./SearchBox";

type RegisteredRoutes =
  RegisteredRouter["routesByPath"][keyof RegisteredRouter["routesByPath"]]["fullPath"];

export type PostsPageLayoutProps = {
  searchQuery?: string;
  selectedTags?: string[];
  popularTags: PopularTag[];
  sortBy: PostSearchParams["sortBy"];
  dateRange: PostSearchParams["dateRange"];
  children: ReactNode;
  fromRoute: RegisteredRoutes;
};

export function PostsPageLayout({
  searchQuery,
  selectedTags = [],
  popularTags,
  sortBy,
  dateRange,
  children,
  fromRoute,
}: PostsPageLayoutProps) {
  return (
    <Box p={4} w="full">
      <Grid gap={6} templateColumns={{ base: "1fr", lg: "1fr 3fr" }} w="full">
        <GridItem>
          <VStack align="stretch" gap={4}>
            <Box border="1px" borderRadius="md" p={4} shadow="md">
              <SearchBox
                defaultTags={selectedTags}
                defaultValue={searchQuery}
              />
            </Box>

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
          </VStack>
        </GridItem>

        <GridItem>{children}</GridItem>
      </Grid>
    </Box>
  );
}
