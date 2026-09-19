CREATE TABLE "style_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"prompt_guidance" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	CONSTRAINT "style_profiles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "style_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_style_profile_id_style_profiles_id_fk" FOREIGN KEY ("style_profile_id") REFERENCES "public"."style_profiles"("id") ON DELETE set null ON UPDATE no action;