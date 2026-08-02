ALTER TYPE "public"."run_status" ADD VALUE 'awaiting_variant_selection' BEFORE 'generating';--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "pending_variants" jsonb;