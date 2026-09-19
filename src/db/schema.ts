import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  integer,
  boolean,
  real,
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
  "awaiting_outline_approval",
  "awaiting_variant_selection",
  "generating",
  "reviewing",
  "generating_images",
  "reviewing_coherence",
  "assembling",
  "done",
  "failed",
]);
export type RunStatus = (typeof runStatusEnum.enumValues)[number];
export type BookType = (typeof bookTypeEnum.enumValues)[number];

export const reviewTypeEnum = pgEnum("review_type", ["structure", "language"]);

// Faz H6: "draft" trades content quality for cost/speed on bulk generation
// steps only (see BOOK_PIPELINE_MODEL_DRAFT in src/lib/ai/model.ts); review/
// QA steps always stay on the full-quality model either way. Defaults to
// "final" so existing behavior (and existing rows, once backfilled) is
// unchanged unless a user opts into draft mode.
export const qualityModeEnum = pgEnum("quality_mode", ["draft", "final"]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  level: text("level"),
  // Faz G3: Clerk user id of the project's owner. Nullable so existing rows
  // created before auth was added don't break the migration - a null owner
  // is treated as inaccessible (owned by no one), not as public, by every
  // authorization check. See ROADMAP.md Faz G3 and src/lib/auth.ts.
  ownerId: text("owner_id"),
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

// Faz H5: named style presets (e.g. "Cambridge-style: task-based, minimal
// text" vs "Oxford-style: context-rich, narrative-driven") that parametrize
// buildStyleBible's prompt in workflows/book-pipeline.tsx, instead of every
// book getting the same one-size-fits-all style guidance.
export const styleProfiles = pgTable("style_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  promptGuidance: text("prompt_guidance").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
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
  styleProfileId: uuid("style_profile_id").references(() => styleProfiles.id, { onDelete: "set null" }),
  qualityMode: qualityModeEnum("quality_mode").notNull().default("final"),
  // Faz H1: free-text target language (e.g. "German", "de", "Almanca") for
  // the generated book. Null means "same language as the source PDF" - the
  // pipeline's original, still-default behavior of detecting and mirroring
  // the source's own language.
  targetLanguage: text("target_language"),
  customNotes: text("custom_notes"),
  unitLimit: integer("unit_limit"),
  requestedBookTypes: jsonb("requested_book_types")
    .$type<string[]>()
    .notNull()
    .default(["student_book", "workbook"]),
  variantCount: integer("variant_count").notNull().default(2),
  modelVersion: text("model_version"),
  tokenUsage: jsonb("token_usage").$type<Record<string, number>>(),
  coverImageUrl: text("cover_image_url"),
  pageImageUrls: jsonb("page_image_urls").$type<Record<number, string>>(),
  pendingVariants: jsonb("pending_variants"),
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

export const unitReviews = pgTable("unit_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => generationRuns.id, { onDelete: "cascade" }),
  unitNumber: integer("unit_number").notNull(),
  reviewType: reviewTypeEnum("review_type").notNull(),
  passed: boolean("passed").notNull(),
  issues: jsonb("issues").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const imageReviews = pgTable("image_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => generationRuns.id, { onDelete: "cascade" }),
  unitNumber: integer("unit_number"),
  pageNumber: integer("page_number"),
  imageUrl: text("image_url").notNull(),
  prompt: text("prompt").notNull(),
  passed: boolean("passed").notNull(),
  issues: jsonb("issues").$type<string[]>().notNull().default([]),
  attempt: integer("attempt").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookCoherenceReviews = pgTable("book_coherence_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => generationRuns.id, { onDelete: "cascade" }),
  passed: boolean("passed").notNull(),
  difficultyProgressionScore: integer("difficulty_progression_score").notNull(),
  vocabularyRepetitionScore: integer("vocabulary_repetition_score").notNull(),
  grammarSequencingScore: integer("grammar_sequencing_score").notNull(),
  thematicConsistencyScore: integer("thematic_consistency_score").notNull(),
  issues: jsonb("issues").$type<CoherenceIssue[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CoherenceIssue = {
  unitNumber: number;
  category: "difficulty" | "vocabulary" | "grammar" | "theme";
  description: string;
  severity: "low" | "medium" | "high";
};

export const originalityChecks = pgTable("originality_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => generationRuns.id, { onDelete: "cascade" }),
  unitNumber: integer("unit_number").notNull(),
  pageNumber: integer("page_number").notNull(),
  ngramOverlapScore: real("ngram_overlap_score").notNull(),
  // F2 (LLM-assisted "structural distance" second opinion) is not
  // implemented yet - column reserved so it can be filled in without a
  // schema change later. See ROADMAP.md Faz F.
  llmAssessment: jsonb("llm_assessment"),
  flagged: boolean("flagged").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Faz H4: every generated variant (not just the one selected), archived
// before the run's `pendingVariants` scratch column is cleared. Previously
// unselected variants were discarded entirely (clearPendingVariants just
// nulled the column) - this is the raw data a future teacher-feedback
// learning loop needs (which variants got picked over which, and why, via
// the issues each one's review flagged).
export const variantHistory = pgTable("variant_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => generationRuns.id, { onDelete: "cascade" }),
  unitNumber: integer("unit_number").notNull(),
  variantIndex: integer("variant_index").notNull(),
  selected: boolean("selected").notNull(),
  passed: boolean("passed").notNull(),
  issues: jsonb("issues").$type<string[]>().notNull().default([]),
  unit: jsonb("unit").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Faz H4: lightweight feedback capture on a finished book - the foundation
// for a future loop that feeds real classroom outcomes back into
// buildStyleBible/prompts. Only captured for now; not yet consumed anywhere.
export const teacherFeedback = pgTable("teacher_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => generationRuns.id, { onDelete: "cascade" }),
  rating: integer("rating"),
  comment: text("comment"),
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
