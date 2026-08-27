CREATE TABLE "post_edit_approvals" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"editId" integer,
	"userId" text,
	CONSTRAINT "post_edit_approvals_pkey" PRIMARY KEY("editId","userId")
);
--> statement-breakpoint
CREATE TABLE "post_edits" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY,
	"payload" json NOT NULL,
	"postId" integer NOT NULL,
	"resolvedAt" timestamp,
	"resolvedBy" text,
	"status" text NOT NULL,
	"suggestedBy" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_edit_approvals" ADD CONSTRAINT "post_edit_approvals_editId_post_edits_id_fkey" FOREIGN KEY ("editId") REFERENCES "post_edits"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post_edit_approvals" ADD CONSTRAINT "post_edit_approvals_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "post_edits" ADD CONSTRAINT "post_edits_postId_posts_id_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post_edits" ADD CONSTRAINT "post_edits_suggestedBy_user_id_fkey" FOREIGN KEY ("suggestedBy") REFERENCES "user"("id");