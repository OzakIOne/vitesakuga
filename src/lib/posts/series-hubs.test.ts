import { describe, expect, it } from "vitest";

import type { PostWithVotes } from "../db/schema";
import { asPostId } from "../ids";
import {
  buildSeriesArchive,
  classifySeriesPost,
  getSeriesNavigation,
} from "./series-hubs";

const makePost = (
  id: number,
  overrides: Partial<PostWithVotes> = {},
): PostWithVotes => ({
  animeTitle: "Mob Psycho 100",
  chapterNumber: null,
  createdAt: `2026-01-0${id}T00:00:00.000Z`,
  description: "Description",
  dislikes: 0,
  episodeNumber: null,
  id: asPostId(id),
  likes: 0,
  relatedPostId: null,
  seasonNumber: null,
  source: null,
  sourceType: null,
  thumbnailKey: `thumbnails/${id}.jpg`,
  title: `Post ${id}`,
  userId: "user-1",
  videoKey: `videos/${id}.mp4`,
  videoMetadata: {},
  volumeNumber: null,
  ...overrides,
});

describe("series metadata", () => {
  it("groups complete episodes and provides ordered navigation", () => {
    const posts = [
      makePost(1, { episodeNumber: 2, seasonNumber: 1 }),
      makePost(2, { episodeNumber: 1, seasonNumber: 1 }),
      makePost(3, { episodeNumber: 1, seasonNumber: 2 }),
    ];

    const archive = buildSeriesArchive(posts);

    expect(archive.episodeGroups.map((group) => group.label)).toEqual([
      "Season 1 · Episode 1",
      "Season 1 · Episode 2",
      "Season 2 · Episode 1",
    ]);
    expect(archive.completeCount).toBe(3);

    const navigation = getSeriesNavigation(posts, 1);
    expect(navigation.previous?.id).toBe(asPostId(2));
    expect(navigation.next?.id).toBe(asPostId(3));
  });

  it("keeps incomplete episode metadata visible for review", () => {
    const post = makePost(1, { episodeNumber: 2 });

    expect(classifySeriesPost(post)).toEqual({
      issues: ["Season number is missing."],
      kind: "episode",
      status: "incomplete",
    });
    expect(buildSeriesArchive([post]).reviewItems).toHaveLength(1);
  });

  it("marks mixed episode and chapter metadata as conflicting", () => {
    const post = makePost(1, {
      chapterNumber: 12,
      episodeNumber: 2,
      seasonNumber: 1,
    });

    expect(classifySeriesPost(post)).toEqual({
      issues: ["Episode metadata also contains volume or chapter numbers."],
      kind: "episode",
      status: "conflicting",
    });
  });

  it("groups manga posts by volume while retaining chapter ordering", () => {
    const posts = [
      makePost(1, {
        animeTitle: "Witch Hat Atelier",
        chapterNumber: 4,
        videoKey: null,
        volumeNumber: 1,
      }),
      makePost(2, {
        animeTitle: "Witch Hat Atelier",
        chapterNumber: 3,
        videoKey: null,
        volumeNumber: 1,
      }),
    ];

    const archive = buildSeriesArchive(posts);

    expect(archive.chapterGroups[0]?.label).toBe("Volume 1");
    expect(
      archive.chapterGroups[0]?.posts.map((post) => post.chapterNumber),
    ).toEqual([3, 4]);
  });
});
