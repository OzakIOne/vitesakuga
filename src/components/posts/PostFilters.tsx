import { useNavigate } from "@tanstack/react-router";
import { Badge } from "src/components/ui/feedback";
import { Stack, VStack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import type { PostsSearchParams } from "src/lib/posts/posts.schema";

import type { PostsPageLayoutProps } from "./PostsPageLayout";

type PostFiltersProps = {
  sortBy: PostsPageLayoutProps["sortBy"];
  dateRange: PostsPageLayoutProps["dateRange"];
  discoveryView: PostsPageLayoutProps["discoveryView"];
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

export const POST_SORT_LABELS = {
  newest: "Newest",
  oldest: "Oldest",
} as const satisfies Record<SortOption["value"], string>;

export const POST_DATE_RANGE_LABELS = {
  all: "All time",
  month: "This month",
  today: "Today",
  week: "This week",
} as const satisfies Record<DateRangeOption["value"], string>;

const SORT_OPTIONS: readonly SortOption[] = [
  { label: POST_SORT_LABELS.newest, value: "newest" },
  { label: POST_SORT_LABELS.oldest, value: "oldest" },
];

const DATE_RANGE_OPTIONS: readonly DateRangeOption[] = [
  { label: POST_DATE_RANGE_LABELS.all, value: "all" },
  { label: POST_DATE_RANGE_LABELS.today, value: "today" },
  { label: POST_DATE_RANGE_LABELS.week, value: "week" },
  { label: POST_DATE_RANGE_LABELS.month, value: "month" },
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
  discoveryView,
  fromRoute,
}: PostFiltersProps) {
  const navigate = useNavigate({ from: fromRoute });
  if (discoveryView !== "chronological") {
    return (
      <Text color="fg.muted" fontSize="xs">
        This view controls its own time window and ordering. Search and tag
        filters still apply.
      </Text>
    );
  }

  return (
    <VStack align="stretch" gap={3}>
      <fieldset className="m-0 border-0 p-0">
        <Text as="legend" fontSize="xs" fontWeight="bold" mb={1}>
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
      </fieldset>
      <fieldset className="m-0 border-0 p-0">
        <Text as="legend" fontSize="xs" fontWeight="bold" mb={1}>
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
      </fieldset>
    </VStack>
  );
}
