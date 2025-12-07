import { z } from "zod";
import type {
  FileUploadData,
  SerializedUploadData,
  VideoSerializableType,
} from "./posts.schema";

async function videoFileToBuffer(file: File): Promise<VideoSerializableType> {
  const arrayBuffer = await file.arrayBuffer();

  return {
    arrayBuffer,
    name: file.name,
    type: file.type,
    size: file.size,
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

  const videoData = await videoFileToBuffer(values.video);
  const thumbnailData = await videoFileToBuffer(values.thumbnail);

  return {
    title: values.title,
    content: values.content,
    source: values.source,
    relatedPostId: values.relatedPostId,
    tags: values.tags,
    userId: values.userId,
    video: videoData,
    thumbnail: thumbnailData,
  };
}

export type SortBy = "latest" | "oldest";
export type DateRange = "all" | "today" | "week" | "month";

export function filterPostsByDateRange<T extends { createdAt: string | Date }>(
  posts: T[],
  dateRange: DateRange,
): T[] {
  if (dateRange === "all") {
    return posts;
  }

  const now = new Date();
  let cutoffDate: Date;

  switch (dateRange) {
    case "today": {
      cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    }
    case "week": {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    }
    case "month": {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    }
    default:
      cutoffDate = new Date(0);
  }

  return posts.filter((post) => {
    const postDate = new Date(post.createdAt);
    return postDate >= cutoffDate;
  });
}

export function sortPostsByDate<T extends { createdAt: string | Date }>(
  posts: T[],
  sortBy: SortBy,
): T[] {
  const sorted = [...posts];

  if (sortBy === "oldest") {
    sorted.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  } else {
    sorted.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  return sorted;
}

export function filterAndSortPosts<T extends { createdAt: string | Date }>(
  posts: T[],
  options: {
    sortBy: SortBy;
    dateRange: DateRange;
  },
): T[] {
  const filtered = filterPostsByDateRange(posts, options.dateRange);
  return sortPostsByDate(filtered, options.sortBy);
}
