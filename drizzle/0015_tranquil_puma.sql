CREATE TYPE "public"."story_artifact_status" AS ENUM('done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."story_artifact_type" AS ENUM('image', 'audio', 'video');--> statement-breakpoint
CREATE TYPE "public"."story_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TABLE "story_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_project_id" uuid NOT NULL,
	"message_id" uuid,
	"type" "story_artifact_type" NOT NULL,
	"url" text,
	"prompt" text NOT NULL,
	"model" text NOT NULL,
	"status" "story_artifact_status" NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_project_id" uuid NOT NULL,
	"role" "story_message_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"title" text NOT NULL,
	"quality_mode" "quality_mode" DEFAULT 'final' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "story_artifacts" ADD CONSTRAINT "story_artifacts_story_project_id_story_projects_id_fk" FOREIGN KEY ("story_project_id") REFERENCES "public"."story_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_artifacts" ADD CONSTRAINT "story_artifacts_message_id_story_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."story_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_messages" ADD CONSTRAINT "story_messages_story_project_id_story_projects_id_fk" FOREIGN KEY ("story_project_id") REFERENCES "public"."story_projects"("id") ON DELETE cascade ON UPDATE no action;