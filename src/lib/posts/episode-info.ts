import type { PostSource } from "../db/schema";

type EpisodeInfoPost = {
  animeTitle?: string | null;
  chapterNumber?: number | null;
  episodeNumber?: number | null;
  seasonNumber?: number | null;
  sourceType?: PostSource | null;
  volumeNumber?: number | null;
};

/**
 * Human-readable source information for a post, e.g.
 * "My Hero Academia · S2 E12", "One Piece Film: Red · Movie",
 * "Naruto · S1 E5", or manga "Ch. 15" / "One Piece · Vol. 98 Ch. 1010".
 * Returns null when the post carries no episode/chapter info.
 */
export function formatEpisodeInfo(post: EpisodeInfoPost): string | null {
  const parts: string[] = [];
  if (post.seasonNumber !== null && post.seasonNumber !== undefined) {
    parts.push(`S${post.seasonNumber}`);
  }
  if (post.episodeNumber !== null && post.episodeNumber !== undefined) {
    parts.push(`E${post.episodeNumber}`);
  }
  if (post.volumeNumber !== null && post.volumeNumber !== undefined) {
    parts.push(`Vol. ${post.volumeNumber}`);
  }
  if (post.chapterNumber !== null && post.chapterNumber !== undefined) {
    parts.push(`Ch. ${post.chapterNumber}`);
  }
  if (post.sourceType === "movie") {
    parts.push("Movie");
  }
  if (parts.length === 0) {
    return post.animeTitle ?? null;
  }
  return post.animeTitle
    ? `${post.animeTitle} · ${parts.join(" ")}`
    : parts.join(" ");
}
