ALTER TABLE "post_edits" ADD COLUMN "previous_payload" json;
--> statement-breakpoint
UPDATE "post_edits" AS edits
SET "previous_payload" = json_build_object(
  'animeTitle', posts."animeTitle",
  'chapterNumber', posts."chapterNumber",
  'description', posts."description",
  'episodeNumber', posts."episodeNumber",
  'seasonNumber', posts."seasonNumber",
  'source', posts."source",
  'title', posts."title",
  'volumeNumber', posts."volumeNumber"
)
FROM "posts" AS posts
WHERE posts."id" = edits."postId";
--> statement-breakpoint
ALTER TABLE "post_edits" ALTER COLUMN "previous_payload" SET NOT NULL;
