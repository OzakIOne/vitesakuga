import type { DiscoveryView } from "./posts.schema";

export type DiscoveryViewInfo = {
  readonly description: string;
  readonly label: string;
  readonly requiresAuthentication: boolean;
  readonly signals: string;
  readonly timeWindow: string;
};

export const DISCOVERY_VIEW_INFO = {
  chronological: {
    description: "The stable default feed for browsing posts in upload order.",
    label: "Chronological",
    requiresAuthentication: false,
    signals: "Upload time; optional date range and sort direction.",
    timeWindow: "User-selected (all time by default)",
  },
  "followed-tags": {
    description: "Recent posts carrying tags you follow.",
    label: "New from followed tags",
    requiresAuthentication: true,
    signals: "Upload time within followed tags; no points or quality score.",
    timeWindow: "Last 14 days",
  },
  "most-liked": {
    description: "Posts receiving the most likes during the current week.",
    label: "Most liked this week",
    requiresAuthentication: false,
    signals: "Likes received in the last 7 days; recency breaks ties.",
    timeWindow: "Last 7 days of voting activity",
  },
  "random-study": {
    description: "A repeatable random queue for deliberate browsing.",
    label: "Random study queue",
    requiresAuthentication: false,
    signals: "A queue seed only; no popularity or quality signal.",
    timeWindow: "All time",
  },
  trending: {
    description: "Posts with positive recent voting momentum.",
    label: "Trending",
    requiresAuthentication: false,
    signals:
      "Likes minus dislikes in the last 7 days; recent likes and upload time break ties.",
    timeWindow: "Last 7 days of voting activity",
  },
  "under-seen": {
    description:
      "A small-visibility experiment for recent posts that have not accumulated many likes yet.",
    label: "Under-seen gems",
    requiresAuthentication: false,
    signals: "All-time like count (five or fewer); upload time breaks ties.",
    timeWindow: "Posts uploaded in the last 30 days",
  },
} as const satisfies Record<DiscoveryView, DiscoveryViewInfo>;

export const DISCOVERY_VIEW_ORDER: readonly DiscoveryView[] = [
  "chronological",
  "trending",
  "most-liked",
  "followed-tags",
  "under-seen",
  "random-study",
];

export const DISCOVERY_TRANSPARENCY_NOTE =
  "Experimental ordering only: points are not used as a proxy for content quality, and these views are not moderation decisions.";
