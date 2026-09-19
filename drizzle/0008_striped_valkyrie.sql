ALTER TYPE "public"."run_status" ADD VALUE 'reviewing_coherence' BEFORE 'assembling';--> statement-breakpoint
CREATE TABLE "book_coherence_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"passed" boolean NOT NULL,
	"difficulty_progression_score" integer NOT NULL,
	"vocabulary_repetition_score" integer NOT NULL,
	"grammar_sequencing_score" integer NOT NULL,
	"thematic_consistency_score" integer NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_coherence_reviews" ADD CONSTRAINT "book_coherence_reviews_run_id_generation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."generation_runs"("id") ON DELETE cascade ON UPDATE no action;