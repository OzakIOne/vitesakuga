import type { PostWithVotes } from "../db/schema";

export type SeriesMetadataPost = Pick<
  PostWithVotes,
  | "animeTitle"
  | "chapterNumber"
  | "episodeNumber"
  | "seasonNumber"
  | "sourceType"
  | "volumeNumber"
>;

type SeriesPostKind = "chapter" | "episode" | "movie" | "other";
type SeriesMetadataStatus = "complete" | "conflicting" | "incomplete";

export type SeriesPostMetadata = {
  readonly issues: readonly string[];
  readonly kind: SeriesPostKind;
  readonly status: SeriesMetadataStatus;
};

export type SeriesArchiveGroup = {
  readonly key: string;
  readonly label: string;
  readonly posts: readonly PostWithVotes[];
};

type SeriesArchiveReviewItem = {
  readonly metadata: SeriesPostMetadata;
  readonly post: PostWithVotes;
};

export type SeriesArchive = {
  readonly chapterGroups: readonly SeriesArchiveGroup[];
  readonly completeCount: number;
  readonly conflictingCount: number;
  readonly episodeGroups: readonly SeriesArchiveGroup[];
  readonly incompleteCount: number;
  readonly moviePosts: readonly PostWithVotes[];
  readonly reviewItems: readonly SeriesArchiveReviewItem[];
};

export type SeriesNavigation = {
  readonly next: PostWithVotes | null;
  readonly previous: PostWithVotes | null;
  readonly reason: string | null;
};

const hasValue = (value: number | null): boolean => value !== null;

export function classifySeriesPost(
  post: SeriesMetadataPost,
): SeriesPostMetadata {
  const hasEpisodeMetadata =
    hasValue(post.seasonNumber) || hasValue(post.episodeNumber);
  const hasChapterMetadata =
    hasValue(post.volumeNumber) || hasValue(post.chapterNumber);
  const issues: string[] = [];
  let kind: SeriesPostKind = "other";
  let isConflicting = false;

  if (post.sourceType === "movie") {
    kind = "movie";
    if (hasEpisodeMetadata || hasChapterMetadata) {
      isConflicting = true;
      issues.push(
        "Movie metadata also contains season, episode, volume, or chapter numbers.",
      );
    }
  } else if (post.sourceType === "tv_series" || hasEpisodeMetadata) {
    kind = "episode";
    if (!hasValue(post.seasonNumber)) {
      issues.push("Season number is missing.");
    }
    if (!hasValue(post.episodeNumber)) {
      issues.push("Episode number is missing.");
    }
    if (hasChapterMetadata) {
      isConflicting = true;
      issues.push("Episode metadata also contains volume or chapter numbers.");
    }
  } else if (hasChapterMetadata) {
    kind = "chapter";
  } else {
    issues.push("Episode, chapter, or volume metadata is missing.");
  }

  if (post.animeTitle === null || post.animeTitle.trim() === "") {
    issues.push("Series title is missing.");
  }

  if (isConflicting) {
    return { issues, kind, status: "conflicting" };
  }

  if (issues.length > 0) {
    return { issues, kind, status: "incomplete" };
  }

  return { issues: [], kind, status: "complete" };
}

const compareCreatedAtDesc = (
  left: PostWithVotes,
  right: PostWithVotes,
): number =>
  String(right.createdAt).localeCompare(String(left.createdAt)) ||
  Number(right.id) - Number(left.id);

const compareEpisodePosts = (
  left: PostWithVotes,
  right: PostWithVotes,
): number =>
  (left.seasonNumber ?? Number.MAX_SAFE_INTEGER) -
    (right.seasonNumber ?? Number.MAX_SAFE_INTEGER) ||
  (left.episodeNumber ?? Number.MAX_SAFE_INTEGER) -
    (right.episodeNumber ?? Number.MAX_SAFE_INTEGER) ||
  compareCreatedAtDesc(left, right);

const compareChapterPosts = (
  left: PostWithVotes,
  right: PostWithVotes,
): number =>
  (left.volumeNumber ?? Number.MAX_SAFE_INTEGER) -
    (right.volumeNumber ?? Number.MAX_SAFE_INTEGER) ||
  (left.chapterNumber ?? Number.MAX_SAFE_INTEGER) -
    (right.chapterNumber ?? Number.MAX_SAFE_INTEGER) ||
  compareCreatedAtDesc(left, right);

function sortGroupPosts(
  posts: readonly PostWithVotes[],
  kind: SeriesPostKind,
): readonly PostWithVotes[] {
  return [...posts].sort(
    kind === "episode"
      ? compareEpisodePosts
      : kind === "chapter"
        ? compareChapterPosts
        : compareCreatedAtDesc,
  );
}

function groupsFromMap(
  groups: Map<string, PostWithVotes[]>,
  kind: "chapter" | "episode",
): SeriesArchiveGroup[] {
  return [...groups.entries()]
    .map(([key, posts]) => {
      const firstPost = posts[0];
      if (kind === "episode") {
        const season = firstPost?.seasonNumber ?? null;
        const episode = firstPost?.episodeNumber ?? null;
        return {
          key,
          label: `Season ${season} · Episode ${episode}`,
          posts: sortGroupPosts(posts, kind),
        };
      }

      const volume = firstPost?.volumeNumber ?? null;
      return {
        key,
        label: volume === null ? "Volume not set" : `Volume ${volume}`,
        posts: sortGroupPosts(posts, kind),
      };
    })
    .sort((left, right) => {
      const leftPost = left.posts[0];
      const rightPost = right.posts[0];
      if (!leftPost || !rightPost) return 0;
      return kind === "episode"
        ? compareEpisodePosts(leftPost, rightPost)
        : compareChapterPosts(leftPost, rightPost);
    });
}

export function buildSeriesArchive(
  posts: readonly PostWithVotes[],
): SeriesArchive {
  const episodeGroups = new Map<string, PostWithVotes[]>();
  const chapterGroups = new Map<string, PostWithVotes[]>();
  const moviePosts: PostWithVotes[] = [];
  const reviewItems: SeriesArchiveReviewItem[] = [];
  let completeCount = 0;
  let incompleteCount = 0;
  let conflictingCount = 0;

  for (const post of posts) {
    const metadata = classifySeriesPost(post);
    if (metadata.status === "complete") {
      completeCount += 1;
      if (metadata.kind === "episode") {
        const key = `${post.seasonNumber}:${post.episodeNumber}`;
        const group = episodeGroups.get(key) ?? [];
        group.push(post);
        episodeGroups.set(key, group);
      } else if (metadata.kind === "chapter") {
        const key = String(post.volumeNumber ?? "unassigned");
        const group = chapterGroups.get(key) ?? [];
        group.push(post);
        chapterGroups.set(key, group);
      } else if (metadata.kind === "movie") {
        moviePosts.push(post);
      }
      continue;
    }

    if (metadata.status === "incomplete") {
      incompleteCount += 1;
    } else {
      conflictingCount += 1;
    }
    reviewItems.push({ metadata, post });
  }

  return {
    chapterGroups: groupsFromMap(chapterGroups, "chapter"),
    completeCount,
    conflictingCount,
    episodeGroups: groupsFromMap(episodeGroups, "episode"),
    incompleteCount,
    moviePosts: sortGroupPosts(moviePosts, "movie"),
    reviewItems: reviewItems.sort((left, right) =>
      compareCreatedAtDesc(left.post, right.post),
    ),
  };
}

export function formatSeriesPosition(
  post: Pick<
    PostWithVotes,
    "chapterNumber" | "episodeNumber" | "seasonNumber" | "volumeNumber"
  >,
): string | null {
  if (post.seasonNumber !== null && post.episodeNumber !== null) {
    return `S${post.seasonNumber} E${post.episodeNumber}`;
  }
  if (post.chapterNumber !== null && post.volumeNumber !== null) {
    return `Vol. ${post.volumeNumber} · Ch. ${post.chapterNumber}`;
  }
  if (post.chapterNumber !== null) {
    return `Ch. ${post.chapterNumber}`;
  }
  if (post.volumeNumber !== null) {
    return `Vol. ${post.volumeNumber}`;
  }
  return null;
}

export function getSeriesNavigation(
  posts: readonly PostWithVotes[],
  currentPostId: number,
): SeriesNavigation {
  const current = posts.find((post) => Number(post.id) === currentPostId);
  if (!current) {
    return {
      next: null,
      previous: null,
      reason: "This post is not present in the series archive.",
    };
  }

  const currentMetadata = classifySeriesPost(current);
  if (
    currentMetadata.status !== "complete" ||
    (currentMetadata.kind !== "episode" && currentMetadata.kind !== "chapter")
  ) {
    return {
      next: null,
      previous: null,
      reason:
        currentMetadata.issues.join(" ") ||
        "Sequence navigation is only available for numbered episodes or chapters.",
    };
  }

  const sequence = posts
    .filter((post) => {
      const metadata = classifySeriesPost(post);
      return (
        metadata.status === "complete" && metadata.kind === currentMetadata.kind
      );
    })
    .sort(
      currentMetadata.kind === "episode"
        ? compareEpisodePosts
        : compareChapterPosts,
    );
  const currentIndex = sequence.findIndex(
    (post) => Number(post.id) === currentPostId,
  );

  return {
    next: sequence[currentIndex + 1] ?? null,
    previous: sequence[currentIndex - 1] ?? null,
    reason: null,
  };
}
