ALTER TYPE "public"."run_status" ADD VALUE 'awaiting_character_approval' BEFORE 'awaiting_variant_selection';--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "art_style" text;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "character_sheets" jsonb;