import type { PostSource } from "../db/schema";

type EpisodeInfoPost = {
  animeTitle?: string | null;
  episodeNumber?: number | null;
  seasonNumber?: number | null;
  sourceType?: PostSource | null;
};

/**
 * Human-readable episode information for a post, e.g.
 * "My Hero Academia · S2 E12", "One Piece Film: Red · Movie",
 * "Naruto · S1 E5". Returns null when the post carries no episode info.
 */
export function formatEpisodeInfo(post: EpisodeInfoPost): string | null {
  if (!post.sourceType || !post.animeTitle) {
    return null;
  }
  if (post.sourceType === "movie") {
    return `${post.animeTitle} · Movie`;
  }
  const parts: string[] = [];
  if (post.seasonNumber !== null && post.seasonNumber !== undefined) {
    parts.push(`S${post.seasonNumber}`);
  }
  if (post.episodeNumber !== null && post.episodeNumber !== undefined) {
    parts.push(`E${post.episodeNumber}`);
  }
  return parts.length > 0
    ? `${post.animeTitle} · ${parts.join(" ")}`
    : post.animeTitle;
}
