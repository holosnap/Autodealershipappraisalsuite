CREATE TYPE "public"."appraisal_status" AS ENUM('draft', 'submitted', 'in_review', 'returned', 'offered', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."overall_grade" AS ENUM('excellent', 'good', 'fair', 'poor');--> statement-breakpoint
CREATE TYPE "public"."note_category" AS ENUM('exterior', 'interior', 'mechanical', 'tires_brakes', 'electrical', 'paint_body', 'history', 'general');--> statement-breakpoint
CREATE TYPE "public"."photo_slot" AS ENUM('front', 'rear', 'driver_side', 'passenger_side', 'interior_front', 'interior_rear', 'odometer', 'vin_plate', 'engine', 'tires', 'damage', 'other');--> statement-breakpoint
CREATE TYPE "public"."photo_status" AS ENUM('pending', 'uploaded');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('salesperson', 'manager', 'admin');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('info', 'minor', 'moderate', 'major');--> statement-breakpoint
CREATE TYPE "public"."title_status" AS ENUM('clean', 'rebuilt', 'salvage', 'lien', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."valuation_kind" AS ENUM('wholesale', 'retail', 'trade_in', 'market_avg', 'offer_basis');--> statement-breakpoint
CREATE TYPE "public"."valuation_source" AS ENUM('manual', 'kbb', 'black_book', 'mmr', 'nada', 'other');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appraisal_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appraisal_id" uuid NOT NULL,
	"actor_id" text,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appraisal_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appraisal_id" uuid NOT NULL,
	"uploaded_by" text NOT NULL,
	"slot" "photo_slot" DEFAULT 'other' NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"size_bytes" integer,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "photo_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appraisal_photos_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "appraisals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"assigned_manager_id" text,
	"status" "appraisal_status" DEFAULT 'draft' NOT NULL,
	"odometer" integer,
	"odometer_unit" text DEFAULT 'mi' NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"stock_number" text,
	"deal_ref" text,
	"title_status" "title_status" DEFAULT 'unknown' NOT NULL,
	"has_lien" boolean DEFAULT false NOT NULL,
	"keys_count" integer,
	"overall_grade" "overall_grade",
	"recon_estimate_cents" integer,
	"offer_cents" integer,
	"offer_expires_at" timestamp with time zone,
	"decision_by" text,
	"decided_at" timestamp with time zone,
	"decision_reason" text,
	"current_valuation_id" uuid,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "condition_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appraisal_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"category" "note_category" DEFAULT 'general' NOT NULL,
	"severity" "severity" DEFAULT 'info' NOT NULL,
	"body" text NOT NULL,
	"est_repair_cents" integer,
	"photo_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "role" DEFAULT 'salesperson' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "valuation_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appraisal_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"source" "valuation_source" DEFAULT 'manual' NOT NULL,
	"kind" "valuation_kind" NOT NULL,
	"value_cents" integer NOT NULL,
	"low_cents" integer,
	"high_cents" integer,
	"odometer_at_valuation" integer,
	"inputs" jsonb,
	"raw_response" jsonb,
	"note" text,
	"valued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vin" text NOT NULL,
	"year" integer,
	"make" text,
	"model" text,
	"trim" text,
	"body_style" text,
	"drivetrain" text,
	"engine" text,
	"transmission" text,
	"exterior_color" text,
	"interior_color" text,
	"decoded_raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_vin_unique" UNIQUE("vin")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appraisal_events" ADD CONSTRAINT "appraisal_events_appraisal_id_appraisals_id_fk" FOREIGN KEY ("appraisal_id") REFERENCES "public"."appraisals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appraisal_events" ADD CONSTRAINT "appraisal_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appraisal_photos" ADD CONSTRAINT "appraisal_photos_appraisal_id_appraisals_id_fk" FOREIGN KEY ("appraisal_id") REFERENCES "public"."appraisals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appraisal_photos" ADD CONSTRAINT "appraisal_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_assigned_manager_id_users_id_fk" FOREIGN KEY ("assigned_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_decision_by_users_id_fk" FOREIGN KEY ("decision_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_notes" ADD CONSTRAINT "condition_notes_appraisal_id_appraisals_id_fk" FOREIGN KEY ("appraisal_id") REFERENCES "public"."appraisals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_notes" ADD CONSTRAINT "condition_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_notes" ADD CONSTRAINT "condition_notes_photo_id_appraisal_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."appraisal_photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_snapshots" ADD CONSTRAINT "valuation_snapshots_appraisal_id_appraisals_id_fk" FOREIGN KEY ("appraisal_id") REFERENCES "public"."appraisals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_snapshots" ADD CONSTRAINT "valuation_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appraisal_events_appraisal_idx" ON "appraisal_events" USING btree ("appraisal_id","created_at");--> statement-breakpoint
CREATE INDEX "appraisal_photos_appraisal_idx" ON "appraisal_photos" USING btree ("appraisal_id","sort_order");--> statement-breakpoint
CREATE INDEX "appraisals_status_created_idx" ON "appraisals" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "appraisals_created_by_idx" ON "appraisals" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "appraisals_vehicle_idx" ON "appraisals" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "condition_notes_appraisal_idx" ON "condition_notes" USING btree ("appraisal_id");--> statement-breakpoint
CREATE INDEX "valuation_snapshots_appraisal_idx" ON "valuation_snapshots" USING btree ("appraisal_id","valued_at");