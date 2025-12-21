import { isAfter, startOfDay, subMonths, subWeeks } from "date-fns";
import { orderBy } from "lodash-es";
import type { ReadChunkFunc } from "mediainfo.js";
import type { PostsSearchParams } from "./posts.schema";

export function makeReadChunk(file: File): ReadChunkFunc {
  return async (chunkSize: number, offset: number) =>
    new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer());
}

export function buildFormData<T extends Record<string, any>>(values: T) {
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    if (value == null) return;

    if (value instanceof File) {
      formData.append(key, value);
      return;
    }

    if (Array.isArray(value) || typeof value === "object") {
      formData.append(key, JSON.stringify(value));
      return;
    }

    formData.append(key, String(value));
  });

  return formData;
}

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
