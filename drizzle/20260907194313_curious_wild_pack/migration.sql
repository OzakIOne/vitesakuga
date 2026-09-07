CREATE TABLE "saved_searches" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"date_range" text NOT NULL,
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"q" text NOT NULL,
	"sort_by" text NOT NULL,
	"tags" json NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "saved_searches_user_name_unique" ON "saved_searches" ("user_id","name");--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;