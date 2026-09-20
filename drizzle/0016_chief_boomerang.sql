ALTER TYPE "public"."story_artifact_status" ADD VALUE 'pending' BEFORE 'done';--> statement-breakpoint
ALTER TABLE "story_artifacts" ADD COLUMN "provider_request_id" text;