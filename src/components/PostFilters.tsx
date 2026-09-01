import { useNavigate } from "@tanstack/react-router";
import { Badge } from "src/components/ui/feedback";
import { Box, Stack, VStack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import type { PostsSearchParams } from "src/lib/posts/posts.schema";

import type { PostsPageLayoutProps } from "./PostsPageLayout";

type PostFiltersProps = {
  sortBy: PostsPageLayoutProps["sortBy"];
  dateRange: PostsPageLayoutProps["dateRange"];
  fromRoute: PostsPageLayoutProps["fromRoute"];
};

type SortOption = {
  label: string;
  value: NonNullable<PostsSearchParams["sortBy"]>;
};
type DateRangeOption = {
  label: string;
  value: NonNullable<PostsSearchParams["dateRange"]>;
};

const SORT_OPTIONS: readonly SortOption[] = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
];

const DATE_RANGE_OPTIONS: readonly DateRangeOption[] = [
  { label: "All Time", value: "all" },
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
];

function FilterButton({
  isActive,
  label,
  onSelect,
}: {
  isActive: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={isActive}
      className="cursor-pointer"
      onClick={onSelect}
      type="button"
    >
      <Badge
        borderRadius="md"
        px={2}
        py={1}
        variant={isActive ? "solid" : "outline"}
      >
        {label}
      </Badge>
    </button>
  );
}

export function PostFilters({
  sortBy,
  dateRange,
  fromRoute,
}: PostFiltersProps) {
  const navigate = useNavigate({ from: fromRoute });

  return (
    <VStack align="stretch" gap={3}>
      <Box>
        <Text fontSize="xs" fontWeight="bold" mb={1}>
          Sort By
        </Text>
        <Stack direction="row" flexWrap="wrap" gap={2}>
          {SORT_OPTIONS.map((option) => (
            <FilterButton
              isActive={sortBy === option.value}
              key={option.value}
              label={option.label}
              onSelect={() => {
                void navigate({
                  search: (prev) => ({ ...prev, sortBy: option.value }),
                });
              }}
            />
          ))}
        </Stack>
      </Box>
      <Box>
        <Text fontSize="xs" fontWeight="bold" mb={1}>
          Date Range
        </Text>
        <Stack direction="row" flexWrap="wrap" gap={2}>
          {DATE_RANGE_OPTIONS.map((option) => (
            <FilterButton
              isActive={dateRange === option.value}
              key={option.value}
              label={option.label}
              onSelect={() => {
                void navigate({
                  search: (prev) => ({ ...prev, dateRange: option.value }),
                });
              }}
            />
          ))}
        </Stack>
      </Box>
    </VStack>
  );
}
