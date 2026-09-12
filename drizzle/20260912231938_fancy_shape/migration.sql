DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION
  WHEN undefined_file OR feature_not_supported THEN NULL;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX "posts_title_trgm_idx" ON "posts" USING gin ("title" gin_trgm_ops);
    CREATE INDEX "posts_description_trgm_idx" ON "posts" USING gin ("description" gin_trgm_ops);
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX "comments_post_created_at_idx" ON "comments" ("postId","createdAt");--> statement-breakpoint
CREATE INDEX "playlists_user_created_at_idx" ON "playlists" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "playlists_public_created_at_idx" ON "playlists" ("is_public","created_at");--> statement-breakpoint
CREATE INDEX "post_edits_post_created_at_idx" ON "post_edits" ("postId","createdAt");--> statement-breakpoint
CREATE INDEX "post_edits_status_created_at_idx" ON "post_edits" ("status","createdAt");--> statement-breakpoint
CREATE INDEX "post_reports_created_at_idx" ON "post_reports" ("createdAt");--> statement-breakpoint
CREATE INDEX "post_tags_tag_id_idx" ON "post_tags" ("tagId");--> statement-breakpoint
CREATE INDEX "post_votes_user_created_at_idx" ON "post_votes" ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "posts_created_at_idx" ON "posts" ("createdAt");--> statement-breakpoint
CREATE INDEX "posts_user_created_at_idx" ON "posts" ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "promotion_reviews_user_created_at_idx" ON "promotion_reviews" ("userId","createdAt");
