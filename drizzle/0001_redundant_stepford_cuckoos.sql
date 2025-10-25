ALTER TABLE "postTags" RENAME TO "post_tags";--> statement-breakpoint
ALTER TABLE "post_tags" DROP CONSTRAINT "postTags_postId_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "post_tags" DROP CONSTRAINT "postTags_tagId_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "post_tags" DROP CONSTRAINT "postTags_postId_tagId_pk";--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_postId_tagId_pk" PRIMARY KEY("postId","tagId");--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_postId_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tagId_tags_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;