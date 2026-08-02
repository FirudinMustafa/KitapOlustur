CREATE TYPE "public"."review_type" AS ENUM('structure', 'language');--> statement-breakpoint
ALTER TYPE "public"."run_status" ADD VALUE 'awaiting_outline_approval' BEFORE 'generating';--> statement-breakpoint
CREATE TABLE "unit_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"unit_number" integer NOT NULL,
	"review_type" "review_type" NOT NULL,
	"passed" boolean NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "model_version" text;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "token_usage" jsonb;--> statement-breakpoint
ALTER TABLE "unit_reviews" ADD CONSTRAINT "unit_reviews_run_id_generation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."generation_runs"("id") ON DELETE cascade ON UPDATE no action;