ALTER TABLE "appraisals" ADD COLUMN "customer_email" text;--> statement-breakpoint
ALTER TABLE "appraisals" ADD COLUMN "purchase_interest" text;--> statement-breakpoint
ALTER TABLE "appraisals" ADD COLUMN "condition" jsonb;--> statement-breakpoint
ALTER TABLE "appraisals" ADD COLUMN "wizard_step" integer DEFAULT 1 NOT NULL;