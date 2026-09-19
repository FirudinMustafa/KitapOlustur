CREATE TABLE "image_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"unit_number" integer,
	"page_number" integer,
	"image_url" text NOT NULL,
	"prompt" text NOT NULL,
	"passed" boolean NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image_reviews" ADD CONSTRAINT "image_reviews_run_id_generation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."generation_runs"("id") ON DELETE cascade ON UPDATE no action;