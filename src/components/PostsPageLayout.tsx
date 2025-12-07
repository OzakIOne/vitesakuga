import { Box, Grid, GridItem, Heading, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { DateRange, SortBy } from "src/lib/posts/posts.utils";
import { PopularTagsSection } from "./PopularTagsSection";
import { PostFilters } from "./PostFilters";
import { SearchBox } from "./SearchBox";

export interface PopularTag {
  id: number;
  name: string;
  postCount: number;
}

export interface PostsPageLayoutProps {
  /** Search query value for the SearchBox */
  searchQuery?: string;
  /** Popular tags to display in the sidebar */
  popularTags: PopularTag[];
  /** Current sort option */
  sortBy: SortBy;
  /** Current date range filter */
  dateRange: DateRange;
  /** Main content area */
  children: ReactNode;
}

/**
 * Shared layout component for posts pages
 * Provides a 2-column layout with sidebar (search, tags, filters) and main content area
 */
export function PostsPageLayout({
  searchQuery,
  popularTags,
  sortBy,
  dateRange,
  children,
}: PostsPageLayoutProps) {
  return (
    <Box w="full" p={4}>
      <Grid templateColumns={{ base: "1fr", lg: "1fr 3fr" }} gap={6} w="full">
        <GridItem>
          <VStack gap={4} align="stretch">
            <Box p={4} borderRadius="md" shadow="md" border="1px">
              <SearchBox defaultValue={searchQuery} />
            </Box>

            <Box p={4} borderRadius="md" shadow="md" border="1px">
              <PopularTagsSection tags={popularTags} />
            </Box>

            <Box p={4} borderRadius="md" shadow="md" border="1px">
              <Heading size="sm" mb={3}>
                Filters
              </Heading>
              <PostFilters sortBy={sortBy} dateRange={dateRange} />
            </Box>
          </VStack>
        </GridItem>

        <GridItem>{children}</GridItem>
      </Grid>
    </Box>
  );
}
