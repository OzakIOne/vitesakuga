import { isAfter, startOfDay, subMonths, subWeeks } from "date-fns";
import { orderBy } from "lodash-es";

import type { PostsSearchParams } from "./posts.schema";

function filterPostsByDateRange<T extends { createdAt: string | Date }>(
  posts: T[],
  dateRange: PostsSearchParams["dateRange"],
): T[] {
  if (dateRange === "all") {
    return posts;
  }

  const now = new Date();
  const cutoffDate =
    {
      month: subMonths(now, 1),
      today: startOfDay(now),
      week: subWeeks(now, 1),
    }[dateRange] ?? new Date(0);

  return posts.filter((post) => isAfter(new Date(post.createdAt), cutoffDate));
}

function sortPostsByDate<T extends { createdAt: string | Date }>(
  posts: T[],
  sortBy: PostsSearchParams["sortBy"],
): T[] {
  return orderBy(
    posts,
    [(post) => new Date(post.createdAt).getTime()],
    [sortBy === "oldest" ? "asc" : "desc"],
  );
}

export function filterAndSortPosts<T extends { createdAt: string | Date }>(
  posts: T[],
  options: {
    sortBy: PostsSearchParams["sortBy"];
    dateRange: PostsSearchParams["dateRange"];
  },
): T[] {
  const filtered = filterPostsByDateRange(posts, options.dateRange);
  return sortPostsByDate(filtered, options.sortBy);
}

export function mapPopularTags(
  t: { id: number; name: string; postCount: number | bigint | string }[],
) {
  return t.map((r) => ({
    id: r.id,
    name: r.name,
    postCount: Number(r.postCount),
  }));
}

const ALLOWED_VIDEO_EXTENSIONS = [
  "ogm",
  "wmv",
  "mpg",
  "webm",
  "ogv",
  "mov",
  "asx",
  "mpeg",
  "mp4",
  "m4v",
  "avi",
  "mkv",
] as const;

export type AllowedVideoExtension = (typeof ALLOWED_VIDEO_EXTENSIONS)[number];
