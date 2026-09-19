CREATE TYPE "public"."quality_mode" AS ENUM('draft', 'final');--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "quality_mode" "quality_mode" DEFAULT 'final' NOT NULL;