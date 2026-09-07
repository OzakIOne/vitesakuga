import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SeriesHub } from "src/components/SeriesHub";
import { Box } from "src/components/ui/layout";
import { seriesHubQuery } from "src/lib/posts/posts.queries";

export const Route = createFileRoute("/series/$seriesTitle")({
  component: SeriesHubRoute,
  ssr: "data-only",
});

function SeriesHubRoute() {
  const { seriesTitle } = Route.useParams();
  const { data } = useSuspenseQuery(seriesHubQuery(seriesTitle));

  return (
    <Box className="mx-auto max-w-[1600px]" p={4} w="full">
      <SeriesHub data={data} />
    </Box>
  );
}
