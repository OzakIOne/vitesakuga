import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "src/components/ui/button";
import { Box, Stack } from "src/components/ui/layout";
import { Heading, Text } from "src/components/ui/typography";

export function NotFound({ children }: { children?: ReactNode }) {
  return (
    <Box className="mx-auto max-w-lg" p={8} textAlign="center">
      <Heading as="h1" mb={3} size="2xl">
        Page not found
      </Heading>
      <Text color="fg.muted" mb={6}>
        {children ?? "The page you are looking for does not exist."}
      </Text>
      <Stack direction="row" flexWrap="wrap" gap={2} justify="center">
        <Button
          onClick={() => {
            window.history.back();
          }}
          variant="outline"
        >
          Go back
        </Button>
        <Button asChild colorPalette="blue">
          <Link to="/">Go home</Link>
        </Button>
      </Stack>
    </Box>
  );
}
