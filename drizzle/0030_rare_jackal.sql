ALTER TYPE "public"."run_status" ADD VALUE 'awaiting_logo_upload' BEFORE 'awaiting_variant_selection';--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "user_logo_url" text;