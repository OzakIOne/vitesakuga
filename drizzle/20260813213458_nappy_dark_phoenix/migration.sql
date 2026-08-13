CREATE TABLE "post_votes" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"postId" integer,
	"userId" text,
	"vote" text NOT NULL,
	CONSTRAINT "post_votes_pkey" PRIMARY KEY("postId","userId")
);
--> statement-breakpoint
ALTER TABLE "post_votes" ADD CONSTRAINT "post_votes_postId_posts_id_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post_votes" ADD CONSTRAINT "post_votes_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;