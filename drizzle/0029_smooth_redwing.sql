ALTER TABLE "generation_runs" ADD COLUMN "is_from_scratch" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "scratch_brief" text;