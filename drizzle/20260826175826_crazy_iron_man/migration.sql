CREATE TABLE "video_revisions" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY,
	"postId" integer NOT NULL,
	"replacedBy" text NOT NULL,
	"videoKey" text NOT NULL,
	"videoMetadata" json NOT NULL
);
--> statement-breakpoint
CREATE INDEX "video_revisions_post_idx" ON "video_revisions" ("postId");--> statement-breakpoint
ALTER TABLE "video_revisions" ADD CONSTRAINT "video_revisions_postId_posts_id_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "video_revisions" ADD CONSTRAINT "video_revisions_replacedBy_user_id_fkey" FOREIGN KEY ("replacedBy") REFERENCES "user"("id");