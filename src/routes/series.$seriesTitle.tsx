import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SeriesHub } from "src/components/SeriesHub";
import { Box } from "src/components/ui/layout";
import { seriesHubQuery } from "src/lib/posts/posts.queries";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/series/$seriesTitle")({
  component: SeriesHubRoute,
  head: ({ params }) => ({
    meta: seo({
      description: `Browse posts from the ${params.seriesTitle} series on ViteSakuga.`,
      title: `${params.seriesTitle} · ViteSakuga`,
    }),
  }),
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
