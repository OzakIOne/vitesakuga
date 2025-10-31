ALTER TABLE "posts" RENAME COLUMN "key" TO "videoKey";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "thumbnailKey" text NOT NULL;