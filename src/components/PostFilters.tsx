import { Badge, Box, Stack, Text, VStack } from "@chakra-ui/react";
import { type RegisteredRouter, useNavigate } from "@tanstack/react-router";

// TODO get types from zod schema
type SortBy = "latest" | "oldest";
type DateRange = "all" | "today" | "week" | "month";

export type RegisteredRoutes =
  RegisteredRouter["routesByPath"][keyof RegisteredRouter["routesByPath"]]["fullPath"];

type PostFiltersProps = {
  sortBy: SortBy;
  dateRange: DateRange;
  fromRoute: RegisteredRoutes;
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
            px={2}
            py={1}
            borderRadius="md"
            cursor="pointer"
            variant={sortBy === "latest" ? "solid" : "outline"}
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, sortBy: "latest" }) })
            }
          >
            Latest
          </Badge>
          <Badge
            px={2}
            py={1}
            borderRadius="md"
            cursor="pointer"
            variant={sortBy === "oldest" ? "solid" : "outline"}
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, sortBy: "oldest" }) })
            }
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
            px={2}
            py={1}
            borderRadius="md"
            cursor="pointer"
            variant={dateRange === "all" ? "solid" : "outline"}
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, dateRange: "all" }) })
            }
          >
            All Time
          </Badge>
          <Badge
            px={2}
            py={1}
            borderRadius="md"
            cursor="pointer"
            variant={dateRange === "today" ? "solid" : "outline"}
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, dateRange: "today" }) })
            }
          >
            Today
          </Badge>
          <Badge
            px={2}
            py={1}
            borderRadius="md"
            cursor="pointer"
            variant={dateRange === "week" ? "solid" : "outline"}
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, dateRange: "week" }) })
            }
          >
            This Week
          </Badge>
          <Badge
            px={2}
            py={1}
            borderRadius="md"
            cursor="pointer"
            variant={dateRange === "month" ? "solid" : "outline"}
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, dateRange: "month" }) })
            }
          >
            This Month
          </Badge>
        </Stack>
      </Box>
    </VStack>
  );
}
