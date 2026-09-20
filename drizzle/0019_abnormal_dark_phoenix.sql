ALTER TYPE "public"."run_status" ADD VALUE 'awaiting_content_approval' BEFORE 'generating_images';--> statement-breakpoint
ALTER TYPE "public"."run_status" ADD VALUE 'awaiting_image_review' BEFORE 'reviewing_coherence';--> statement-breakpoint
ALTER TYPE "public"."run_status" ADD VALUE 'awaiting_final_approval' BEFORE 'assembling';--> statement-breakpoint
ALTER TYPE "public"."run_status" ADD VALUE 'changes_requested' BEFORE 'failed';--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "pending_content_approval" jsonb;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "pending_image_review" jsonb;