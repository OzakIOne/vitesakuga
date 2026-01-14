import { Badge, Box, Stack, Text, VStack } from "@chakra-ui/react";
import { useNavigate } from "@tanstack/react-router";
import type { PostsPageLayoutProps } from "./PostsPageLayout";

type PostFiltersProps = {
  sortBy: PostsPageLayoutProps["sortBy"];
  dateRange: PostsPageLayoutProps["dateRange"];
  fromRoute: PostsPageLayoutProps["fromRoute"];
};

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
          <Badge
            borderRadius="md"
            cursor="pointer"
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, sortBy: "newest" }) })
            }
            px={2}
            py={1}
            variant={sortBy === "newest" ? "solid" : "outline"}
          >
            Newest
          </Badge>
          <Badge
            borderRadius="md"
            cursor="pointer"
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, sortBy: "oldest" }) })
            }
            px={2}
            py={1}
            variant={sortBy === "oldest" ? "solid" : "outline"}
          >
            Oldest
          </Badge>
        </Stack>
      </Box>
      <Box>
        <Text fontSize="xs" fontWeight="bold" mb={1}>
          Date Range
        </Text>
        <Stack direction="row" flexWrap="wrap" gap={2}>
          <Badge
            borderRadius="md"
            cursor="pointer"
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, dateRange: "all" }) })
            }
            px={2}
            py={1}
            variant={dateRange === "all" ? "solid" : "outline"}
          >
            All Time
          </Badge>
          <Badge
            borderRadius="md"
            cursor="pointer"
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, dateRange: "today" }) })
            }
            px={2}
            py={1}
            variant={dateRange === "today" ? "solid" : "outline"}
          >
            Today
          </Badge>
          <Badge
            borderRadius="md"
            cursor="pointer"
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, dateRange: "week" }) })
            }
            px={2}
            py={1}
            variant={dateRange === "week" ? "solid" : "outline"}
          >
            This Week
          </Badge>
          <Badge
            borderRadius="md"
            cursor="pointer"
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, dateRange: "month" }) })
            }
            px={2}
            py={1}
            variant={dateRange === "month" ? "solid" : "outline"}
          >
            This Month
          </Badge>
        </Stack>
      </Box>
    </VStack>
  );
}
