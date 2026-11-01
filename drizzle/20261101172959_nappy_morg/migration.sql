ALTER TABLE "user" ADD COLUMN "suspendedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "suspendedReason" text;