CREATE TABLE "twoFactor" (
	"backupCodes" text NOT NULL,
	"failedVerificationCount" integer DEFAULT 0 NOT NULL,
	"id" text PRIMARY KEY,
	"lockedUntil" timestamp,
	"secret" text NOT NULL,
	"userId" text NOT NULL,
	"verified" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "twoFactorEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor" ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor" ("userId");--> statement-breakpoint
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;