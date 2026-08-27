CREATE TABLE "post_reports" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"postId" integer,
	"reason" text NOT NULL,
	"userId" text,
	CONSTRAINT "post_reports_pkey" PRIMARY KEY("postId","userId")
);
--> statement-breakpoint
ALTER TABLE "post_reports" ADD CONSTRAINT "post_reports_postId_posts_id_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post_reports" ADD CONSTRAINT "post_reports_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;