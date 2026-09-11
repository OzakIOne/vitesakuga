import type { ReactNode } from "react";
import { Stack } from "src/components/ui/layout";
import { Heading, Text } from "src/components/ui/typography";

type EmptyStateProps = {
  action?: ReactNode;
  description?: ReactNode;
  size?: "compact" | "default";
  title: ReactNode;
  titleAs?: "h2" | "h3" | "p";
};

export function EmptyState({
  action,
  description,
  size = "default",
  title,
  titleAs = "h2",
}: EmptyStateProps) {
  const isCompact = size === "compact";

  return (
    <Stack
      align="center"
      border={isCompact ? undefined : "1px"}
      borderRadius="md"
      gap={isCompact ? 1 : 3}
      justify="center"
      minH={isCompact ? undefined : "12rem"}
      p={isCompact ? 3 : 6}
      textAlign="center"
    >
      <Heading as={titleAs} size={isCompact ? "sm" : "md"}>
        {title}
      </Heading>
      {description && (
        <Text color="fg.muted" fontSize={isCompact ? "xs" : undefined}>
          {description}
        </Text>
      )}
      {action}
    </Stack>
  );
}
