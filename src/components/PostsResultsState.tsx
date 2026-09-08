import type { ReactNode } from "react";
import { Button } from "src/components/ui/button";
import { Badge, Spinner } from "src/components/ui/feedback";
import { Box, Stack, VStack, Wrap } from "src/components/ui/layout";
import { Heading, Text } from "src/components/ui/typography";

type PostsResultsStateProps = {
  activeFilters: readonly string[];
  children: ReactNode;
  error: Error | null;
  hasLoadedPosts: boolean;
  isPending: boolean;
  onClearFilters: () => void;
  onRetry: () => void;
  resultCount: number;
};

function ResultsSummary({
  activeFilters,
  resultCount,
}: Pick<PostsResultsStateProps, "activeFilters" | "resultCount">) {
  const resultLabel = `${String(resultCount)} ${resultCount === 1 ? "result" : "results"}`;

  return (
    <Box border="1px" borderRadius="md" p={3}>
      <Text fontWeight="semibold">{resultLabel}</Text>
      {activeFilters.length > 0 ? (
        <Wrap gap={2} mt={2}>
          {activeFilters.map((filter) => (
            <Badge key={filter} variant="subtle">
              {filter}
            </Badge>
          ))}
        </Wrap>
      ) : (
        <Text color="fg.muted" fontSize="sm" mt={1}>
          No active filters
        </Text>
      )}
    </Box>
  );
}

function StatePanel({
  children,
  role,
}: {
  children: ReactNode;
  role?: "alert";
}) {
  return (
    <Stack
      align="center"
      border="1px"
      borderRadius="md"
      gap={3}
      justify="center"
      minH="16rem"
      p={8}
      aria-live={role === "alert" ? "assertive" : "polite"}
      role={role}
      textAlign="center"
    >
      {children}
    </Stack>
  );
}

export function PostsResultsState({
  activeFilters,
  children,
  error,
  hasLoadedPosts,
  isPending,
  onClearFilters,
  onRetry,
  resultCount,
}: PostsResultsStateProps) {
  if (isPending && !hasLoadedPosts) {
    return (
      <StatePanel>
        <Spinner />
        <Text>Loading posts...</Text>
      </StatePanel>
    );
  }

  if (error && !hasLoadedPosts) {
    return (
      <StatePanel role="alert">
        <Heading size="md">Could not load posts</Heading>
        <Text color="fg.muted">
          The results could not be loaded. Check your connection and try again.
        </Text>
        <Stack direction="row" gap={2}>
          <Button onClick={onRetry}>Retry</Button>
          <Button onClick={onClearFilters} variant="outline">
            Clear filters
          </Button>
        </Stack>
      </StatePanel>
    );
  }

  if (!isPending && !error && resultCount === 0) {
    return (
      <VStack align="stretch" gap={4}>
        <ResultsSummary
          activeFilters={activeFilters}
          resultCount={resultCount}
        />
        <StatePanel>
          <Heading size="md">No posts found</Heading>
          <Text color="fg.muted">
            Try changing your search or clearing the active filters.
          </Text>
          <Button onClick={onClearFilters}>Clear filters</Button>
        </StatePanel>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" gap={4}>
      {error && hasLoadedPosts && (
        <Stack align="center" border="1px" borderRadius="md" gap={3} p={4}>
          <Text color="red.600">
            New results could not be loaded. Try again.
          </Text>
          <Button onClick={onRetry} size="sm" variant="outline">
            Retry
          </Button>
        </Stack>
      )}
      <ResultsSummary activeFilters={activeFilters} resultCount={resultCount} />
      {children}
    </VStack>
  );
}
