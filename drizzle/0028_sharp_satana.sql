CREATE TYPE "public"."trim_size" AS ENUM('a4', '6x9', '7x10');--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "trim_size" "trim_size" DEFAULT 'a4' NOT NULL;