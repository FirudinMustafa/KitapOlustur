ALTER TYPE "public"."book_type" ADD VALUE 'teacher_book';--> statement-breakpoint
ALTER TYPE "public"."book_type" ADD VALUE 'test_booklet';--> statement-breakpoint
ALTER TYPE "public"."run_status" ADD VALUE 'mapping_pages' BEFORE 'extracting';--> statement-breakpoint
ALTER TYPE "public"."run_status" ADD VALUE 'generating_images' BEFORE 'assembling';--> statement-breakpoint
CREATE TABLE "source_page_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"total_pages" integer NOT NULL,
	"pages" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "requested_book_types" jsonb DEFAULT '["student_book","workbook"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "variant_count" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "source_page_maps" ADD CONSTRAINT "source_page_maps_run_id_generation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."generation_runs"("id") ON DELETE cascade ON UPDATE no action;