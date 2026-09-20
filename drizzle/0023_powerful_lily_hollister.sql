ALTER TABLE "generation_runs" ADD COLUMN "cost_usage" jsonb;--> statement-breakpoint
ALTER TABLE "story_artifacts" ADD COLUMN "cost_usd" real;