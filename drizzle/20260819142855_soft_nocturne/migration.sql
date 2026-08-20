CREATE TABLE "passkey" (
	"aaguid" text,
	"backedUp" boolean NOT NULL,
	"counter" integer NOT NULL,
	"createdAt" timestamp,
	"credentialID" text NOT NULL,
	"deviceType" text NOT NULL,
	"id" text PRIMARY KEY,
	"name" text,
	"publicKey" text NOT NULL,
	"transports" text,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "passkey_credentialID_unique" ON "passkey" ("credentialID");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" ("userId");--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;