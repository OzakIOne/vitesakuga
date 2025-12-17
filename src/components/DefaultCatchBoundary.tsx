import { Button } from "@chakra-ui/react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import {
  ErrorComponent,
  Link,
  rootRouteId,
  useMatch,
  useRouter,
} from "@tanstack/react-router";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const isRoot = useMatch({
    select: (state) => state.id === rootRouteId,
    strict: false,
  });

  console.error("DefaultCatchBoundary Error:", error);

  return (
    <div className="min-w-0 flex-1 p-4 flex flex-col items-center justify-center gap-6">
      <ErrorComponent error={error} />
      <div className="flex gap-2 items-center flex-wrap">
        <Button
          onClick={async () => {
            await router.invalidate();
          }}
        >
          Try Again
        </Button>
        {isRoot ? (
          <Link
            className={`px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded text-white uppercase font-extrabold`}
            to="/"
          >
            Home
          </Link>
        ) : (
          <Link
            className={`px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded text-white uppercase font-extrabold`}
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
