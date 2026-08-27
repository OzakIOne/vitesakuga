CREATE TABLE "points_ledger" (
	"action" text NOT NULL,
	"actorId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY,
	"points" integer NOT NULL,
	"refId" integer,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "points_ledger_earning_unique" ON "points_ledger" ("userId","action","refId","actorId");--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;