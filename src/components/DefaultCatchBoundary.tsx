import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link, rootRouteId, useMatch, useRouter } from "@tanstack/react-router";
import { Button } from "src/components/ui/button";
import { Alert } from "src/components/ui/feedback";
import { Box, Stack } from "src/components/ui/layout";
import { Heading, Text } from "src/components/ui/typography";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const isRoot = useMatch({
    select: (state) => state.id === rootRouteId,
    strict: false,
  });

  // No client-side console.error: the error may carry server internals. The
  // server logs the full failure annotated with a debug ID (see
  // `createHandler` in src/lib/server-fn.handler.ts).

  return (
    <Box className="mx-auto max-w-lg" p={8}>
      <Heading as="h1" mb={3} size="2xl">
        Something went wrong
      </Heading>
      <Text color="fg.muted" mb={6}>
        The page could not be loaded. Try again, or return to a working page.
      </Text>
      {import.meta.env.DEV && (
        <Alert.Root className="mb-6" status="error">
          <Alert.Content>
            <Alert.Indicator status="error" />
            <div className="min-w-0">
              <Alert.Title>Development details</Alert.Title>
              <Alert.Description className="break-words whitespace-pre-wrap">
                {String(error)}
              </Alert.Description>
            </div>
          </Alert.Content>
        </Alert.Root>
      )}
      <Stack direction="row" flexWrap="wrap" gap={2}>
        <Button
          onClick={async () => {
            await router.invalidate();
          }}
        >
          Try again
        </Button>
        {isRoot ? (
          <Button asChild variant="outline">
            <Link to="/">Go home</Link>
          </Button>
        ) : (
          <Button
            onClick={() => {
              window.history.back();
            }}
            variant="outline"
          >
            Go back
          </Button>
        )}
      </Stack>
    </Box>
  );
}
