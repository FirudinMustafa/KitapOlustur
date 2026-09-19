CREATE TABLE "originality_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"unit_number" integer NOT NULL,
	"page_number" integer NOT NULL,
	"ngram_overlap_score" real NOT NULL,
	"llm_assessment" jsonb,
	"flagged" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "originality_checks" ADD CONSTRAINT "originality_checks_run_id_generation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."generation_runs"("id") ON DELETE cascade ON UPDATE no action;