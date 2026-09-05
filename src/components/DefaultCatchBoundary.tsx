import type { ErrorComponentProps } from "@tanstack/react-router";
import {
  ErrorComponent,
  Link,
  rootRouteId,
  useMatch,
  useRouter,
} from "@tanstack/react-router";
import { Button } from "src/components/ui/button";

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
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-6 p-4">
      <ErrorComponent error={error} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={async () => {
            await router.invalidate();
          }}
        >
          Try Again
        </Button>
        {isRoot ? (
          <Link
            className="rounded bg-gray-600 px-2 py-1 font-extrabold text-white uppercase dark:bg-gray-700"
            to="/"
          >
            Home
          </Link>
        ) : (
          <Link
            className="rounded bg-gray-600 px-2 py-1 font-extrabold text-white uppercase dark:bg-gray-700"
            onClick={(e) => {
              e.preventDefault();
              window.history.back();
            }}
            to="/"
          >
            Go Back
          </Link>
        )}
      </div>
    </div>
  );
}
