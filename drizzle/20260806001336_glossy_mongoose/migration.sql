ALTER TABLE "account" ADD COLUMN "issuer" text DEFAULT 'local:credential' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_unique" ON "account" ("issuer","accountId");