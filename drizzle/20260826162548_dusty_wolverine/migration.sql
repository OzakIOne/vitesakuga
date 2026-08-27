CREATE TABLE "post_images" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"postId" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"storageKey" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "videoKey" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "post_images_post_id_position_idx" ON "post_images" ("postId","position");--> statement-breakpoint
ALTER TABLE "post_images" ADD CONSTRAINT "post_images_postId_posts_id_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE;