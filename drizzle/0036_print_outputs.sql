ALTER TABLE "generated_books" ADD COLUMN "print_pdf_blob_url" text;--> statement-breakpoint
ALTER TABLE "generated_books" ADD COLUMN "cover_spread_blob_url" text;--> statement-breakpoint
ALTER TABLE "generated_books" ADD COLUMN "print_report" jsonb;