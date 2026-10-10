ALTER TYPE "public"."run_status" ADD VALUE 'reviewing_design' BEFORE 'awaiting_final_approval';--> statement-breakpoint
CREATE TABLE "page_design_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"book_type" "book_type" NOT NULL,
	"pdf_page" integer NOT NULL,
	"unit_number" integer,
	"page_index" integer,
	"page_count" integer DEFAULT 1 NOT NULL,
	"score" integer NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_fix" text DEFAULT 'none' NOT NULL,
	"applied_fix" text,
	"reference_gap" text,
	"image_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "reference_page_urls" jsonb;--> statement-breakpoint
ALTER TABLE "page_design_reviews" ADD CONSTRAINT "page_design_reviews_run_id_generation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."generation_runs"("id") ON DELETE cascade ON UPDATE no action;