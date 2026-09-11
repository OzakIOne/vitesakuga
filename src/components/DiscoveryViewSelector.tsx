import {
  useNavigate,
  useRouteContext,
  type RegisteredRouter,
} from "@tanstack/react-router";
import { Badge } from "src/components/ui/feedback";
import { Stack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import {
  DISCOVERY_VIEW_INFO,
  DISCOVERY_VIEW_ORDER,
} from "src/lib/posts/discovery";
import type { DiscoveryView } from "src/lib/posts/posts.schema";

type DiscoveryViewSelectorProps = {
  fromRoute: RegisteredRouter["routesByPath"][keyof RegisteredRouter["routesByPath"]]["fullPath"];
  view: DiscoveryView;
};

export function DiscoveryViewSelector({
  fromRoute,
  view,
}: DiscoveryViewSelectorProps) {
  const navigate = useNavigate({ from: fromRoute });
  const { user } = useRouteContext({ from: "__root__" });
  return (
    <fieldset className="m-0 border-0 p-0">
      <Text as="legend" fontSize="xs" fontWeight="bold" mb={1}>
        Browse Posts
      </Text>
      <Text color="fg.muted" fontSize="xs" mb={2}>
        Choose how posts are ordered. Newest first is the default.
      </Text>
      <Stack direction="row" flexWrap="wrap" gap={2}>
        {DISCOVERY_VIEW_ORDER.map((option) => {
          const info = DISCOVERY_VIEW_INFO[option];
          const needsLogin = info.requiresAuthentication && user === null;
          return (
            <button
              aria-pressed={view === option}
              className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              disabled={needsLogin}
              key={option}
              onClick={() => {
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    page: 0,
                    randomSeed:
                      option === "random-study"
                        ? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
                        : 0,
                    view: option,
                  }),
                });
              }}
              title={needsLogin ? "Sign in to follow tags" : info.description}
              type="button"
            >
              <Badge
                borderRadius="md"
                px={2}
                py={1}
                variant={view === option ? "solid" : "outline"}
              >
                {info.label}
              </Badge>
            </button>
          );
        })}
      </Stack>
      {user === null && (
        <Text color="fg.muted" fontSize="xs" mt={2}>
          Sign in to unlock followed-tag discovery.
        </Text>
      )}
    </fieldset>
  );
}
