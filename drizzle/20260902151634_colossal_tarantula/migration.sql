CREATE TABLE "comment_mentions" (
	"commentId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"userId" text,
	CONSTRAINT "comment_mentions_pkey" PRIMARY KEY("commentId","userId")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "username" text;--> statement-breakpoint
-- Backfill a unique handle for every existing user: slug of the display name
-- plus a short hash of the user id, so two users with the same name never
-- collide. Dev-stage data only; new sign-ups get their handle from the
-- username generator in src/lib/auth.
UPDATE "user"
SET "username" = concat(
	substr(regexp_replace(lower("name"), '[^a-z0-9_]', '', 'g'), 1, 24),
	'_',
	substr(md5("id"), 1, 6)
)
WHERE "username" IS NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "postId" integer;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_username_key" UNIQUE("username");--> statement-breakpoint
CREATE INDEX "comment_mentions_user_idx" ON "comment_mentions" ("userId");--> statement-breakpoint
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_commentId_comments_id_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;