import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  integer,
  boolean,
} from "drizzle-orm/pg-core";

export const sourceBookTypeEnum = pgEnum("source_book_type", ["student_book", "workbook"]);

export const bookTypeEnum = pgEnum("book_type", [
  "student_book",
  "workbook",
  "teacher_book",
  "test_booklet",
]);

export const runStatusEnum = pgEnum("run_status", [
  "pending",
  "mapping_pages",
  "extracting",
  "analyzing",
  "generating",
  "reviewing",
  "generating_images",
  "assembling",
  "done",
  "failed",
]);
export type RunStatus = (typeof runStatusEnum.enumValues)[number];
export type BookType = (typeof bookTypeEnum.enumValues)[number];

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  level: text("level"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sourceUploads = pgTable("source_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  blobUrl: text("blob_url").notNull(),
  filename: text("filename").notNull(),
  bookType: sourceBookTypeEnum("book_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const niceToHaveItems = pgTable("nice_to_have_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isDefaultSelected: boolean("is_default_selected").notNull().default(true),
});

export const generationRuns = pgTable("generation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  workflowRunId: text("workflow_run_id"),
  status: runStatusEnum("status").notNull().default("pending"),
  currentStage: text("current_stage"),
  selectedNiceToHaveIds: jsonb("selected_nice_to_have_ids").$type<string[]>().notNull().default([]),
  customNotes: text("custom_notes"),
  unitLimit: integer("unit_limit"),
  requestedBookTypes: jsonb("requested_book_types")
    .$type<string[]>()
    .notNull()
    .default(["student_book", "workbook"]),
  variantCount: integer("variant_count").notNull().default(2),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const extractedOutlines = pgTable("extracted_outlines", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => generationRuns.id, { onDelete: "cascade" }),
  outline: jsonb("outline").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sourcePageMaps = pgTable("source_page_maps", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => generationRuns.id, { onDelete: "cascade" }),
  totalPages: integer("total_pages").notNull(),
  pages: jsonb("pages").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const generatedBooks = pgTable("generated_books", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => generationRuns.id, { onDelete: "cascade" }),
  bookType: bookTypeEnum("book_type").notNull(),
  content: jsonb("content"),
  markdown: text("markdown"),
  pdfBlobUrl: text("pdf_blob_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
