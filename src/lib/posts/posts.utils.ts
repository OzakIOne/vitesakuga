import { isAfter, startOfDay, subMonths, subWeeks } from "date-fns";
import { orderBy } from "lodash-es";
import type {
  BufferSerializableType,
  FileUploadData,
  PostSearchParams,
  SerializedUploadData,
} from "./posts.schema";

async function fileToBuffer(file: File): Promise<BufferSerializableType> {
  const arrayBuffer = await file.arrayBuffer();

  return {
    arrayBuffer,
    name: file.name,
    size: file.size,
    type: file.type,
  };
}

export async function transformUploadFormData(
  values: FileUploadData,
): Promise<SerializedUploadData> {
  if (!values.video) {
    throw new Error("Video file is required");
  }
  if (!values.thumbnail) {
    throw new Error("Thumbnail file is required");
  }

  const videoData = await fileToBuffer(values.video);
  const thumbnailData = await fileToBuffer(values.thumbnail);

  return {
    content: values.content,
    relatedPostId: values.relatedPostId,
    source: values.source,
    tags: values.tags,
    thumbnail: thumbnailData,
    title: values.title,
    userId: values.userId,
    video: videoData,
  };
}

export function filterPostsByDateRange<T extends { createdAt: string | Date }>(
  posts: T[],
  dateRange: PostSearchParams["dateRange"],
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

export function sortPostsByDate<T extends { createdAt: string | Date }>(
  posts: T[],
  sortBy: PostSearchParams["sortBy"],
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
    sortBy: PostSearchParams["sortBy"];
    dateRange: PostSearchParams["dateRange"];
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
