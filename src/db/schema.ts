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

// Faz "İnsan-onaylı üretim hattı" (2026-09-20, ROADMAP.md): three new
// checkpoints added after researching real publishing workflows -
// content/copyedit must be human-approved before design (images) starts,
// flagged images get routed to a human instead of silently shipping the
// last failed attempt, and a final sign-off gate exists before assembly.
// Deliberately NOT "approve every single unit/image" - the research found
// no real source recommending uniform per-item gating; these three are
// batched (all units' text at once, all flagged images at once) matching
// the "staged release" pattern for bulk AI content review.
export const runStatusEnum = pgEnum("run_status", [
  "pending",
  "mapping_pages",
  "extracting",
  "analyzing",
  "awaiting_outline_approval",
  "awaiting_variant_selection",
  "generating",
  "reviewing",
  "awaiting_content_approval",
  "generating_images",
  "awaiting_image_review",
  "reviewing_coherence",
  "awaiting_final_approval",
  "assembling",
  "done",
  "changes_requested",
  "failed",
]);
export type RunStatus = (typeof runStatusEnum.enumValues)[number];
export type BookType = (typeof bookTypeEnum.enumValues)[number];

// "moderation" (2026-09-20, ROADMAP.md): content-safety check for generated
// text - the image QA prompt (reviewImage in workflows/book-pipeline.tsx)
// already screened images for age-appropriateness, but nothing screened the
// generated text itself for a children's-education product. Same enum, same
// unitReviews table, same retry-with-feedback flow as the other three - not
// a separate moderation system.
// "skill_balance" (Faz "Beceri Dengesi Denetçisi", 2026-09-21): checks a unit
// has at least two of reading/writing/listening/speaking concretely
// represented - same unitReviews table, same retry-with-feedback flow as the
// other four.
export const reviewTypeEnum = pgEnum("review_type", ["structure", "language", "level", "moderation", "skill_balance"]);

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
  // Faz "ISBN/baskıya hazırlık" (2026-09-20, ROADMAP.md): optional, only
  // meaningful for a project the user actually intends to print/publish.
  // Validated (ISBN-13 checksum, see src/lib/isbn.ts) before being saved -
  // never auto-generated, this has to be a real ISBN the user owns/bought.
  isbn: text("isbn"),
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
  // Faz "Gerçek maliyet takibi" (2026-09-21, ROADMAP.md): image/audio
  // generation isn't priced per-token, so it can't share tokenUsage above -
  // this is the $-denominated counterpart, same jsonb-accumulator shape
  // (per-category key + "total"), populated by recordCost in
  // workflows/book-pipeline.tsx using src/lib/ai/pricing.ts's rates.
  costUsage: jsonb("cost_usage").$type<Record<string, number>>(),
  coverImageUrl: text("cover_image_url"),
  pageImageUrls: jsonb("page_image_urls").$type<Record<number, string>>(),
  pendingVariants: jsonb("pending_variants"),
  // Scratch columns for the two new batch approval gates - same pattern as
  // pendingVariants above (holds data only while the run is paused waiting
  // on the corresponding hook; not meant as permanent storage).
  pendingContentApproval: jsonb("pending_content_approval"),
  pendingImageReview: jsonb("pending_image_review"),
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
  // Faz F2: LLM-assisted second opinion, only computed for rows F1 already
  // flagged (see checkOriginality in workflows/book-pipeline.tsx). Null for
  // unflagged rows - never called for those, keeping the added LLM cost
  // proportional to actual risk. See ROADMAP.md Faz F.
  llmAssessment: jsonb("llm_assessment").$type<OriginalityLlmAssessment>(),
  flagged: boolean("flagged").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OriginalityLlmAssessment = {
  similarityLevel: "low" | "medium" | "high";
  rationale: string;
  concerningPhrases: string[];
};

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

// Faz "Granüler editöryel feedback" (2026-09-20, ROADMAP.md): audit trail of
// human-authored, per-unit change requests made during the content-approval
// gate (workflows/book-pipeline.tsx). Separate from teacherFeedback below (a
// single, coarse, run-level rating/comment left after the fact) - this
// captures the actual back-and-forth ("regenerate unit 3, the dialogue felt
// unnatural") that drives a real regeneration, one round at a time.
export const unitFeedback = pgTable("unit_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => generationRuns.id, { onDelete: "cascade" }),
  unitNumber: integer("unit_number").notNull(),
  round: integer("round").notNull(),
  comment: text("comment").notNull(),
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
  // Digital/accessible sibling export - see src/lib/epub/BookEpub.ts. Null
  // for books assembled before EPUB export existed (no backfill).
  epubBlobUrl: text("epub_blob_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Hikaye Stüdyosu: free-form, chat-driven content studio - deliberately
// separate from projects/generationRuns (the fixed-stage, PDF-rewrite
// pipeline above). A story project has no source PDF and no fixed
// stage sequence; it's a conversation the user can direct however they
// like (write a story, ask for an image, ask for narration, in any
// order, or just one of those in isolation). See ROADMAP.md "Hikaye
// Stüdyosu".
export const storyMessageRoleEnum = pgEnum("story_message_role", ["user", "assistant"]);
export const storyArtifactTypeEnum = pgEnum("story_artifact_type", ["image", "audio", "video"]);
// "pending" is only ever used by video artifacts - Higgsfield's API is
// async (submit -> poll a request_id), unlike the image/audio providers
// which return the finished asset inline within one request. See
// src/lib/ai/higgsfield.ts and ROADMAP.md "Hikaye Stüdyosu" video notu.
export const storyArtifactStatusEnum = pgEnum("story_artifact_status", ["pending", "done", "failed"]);

export const storyProjects = pgTable("story_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id"),
  title: text("title").notNull(),
  qualityMode: qualityModeEnum("quality_mode").notNull().default("final"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const storyMessages = pgTable("story_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyProjectId: uuid("story_project_id")
    .notNull()
    .references(() => storyProjects.id, { onDelete: "cascade" }),
  role: storyMessageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const storyArtifacts = pgTable("story_artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyProjectId: uuid("story_project_id")
    .notNull()
    .references(() => storyProjects.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").references(() => storyMessages.id, { onDelete: "set null" }),
  // Video generation is fully wired (Higgsfield image-to-video, see
  // src/lib/ai/higgsfield.ts) but stays inert - every call short-circuits
  // to a "failed" result with an explanatory message - until HF_API_KEY_ID/
  // HF_API_KEY_SECRET are set. See ROADMAP.md "Hikaye Stüdyosu".
  type: storyArtifactTypeEnum("type").notNull(),
  url: text("url"),
  prompt: text("prompt").notNull(),
  model: text("model").notNull(),
  status: storyArtifactStatusEnum("status").notNull(),
  errorMessage: text("error_message"),
  // Higgsfield's request_id, set only while a video artifact is "pending" -
  // used to poll GET /requests/{id}/status until it reaches a terminal
  // state. Null for image/audio artifacts (those resolve synchronously).
  providerRequestId: text("provider_request_id"),
  // Faz "Gerçek maliyet takibi": per-artifact cost in USD, computed at
  // generation time (src/lib/ai/pricing.ts) - shown right next to the
  // artifact in the studio gallery (StudioWorkspace.tsx), unlike the main
  // book pipeline's aggregate run-level total (costUsage above), since here
  // each artifact is its own standalone thing a user reacts to individually.
  // Null for video (not priced yet - see pricing.ts) or a failed generation.
  costUsd: real("cost_usd"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Faz "Gelişmiş Görsel Üretim Paneli" (2026-09-21, ROADMAP.md): a personal,
// cross-project library of reference images the user can tag and re-use
// across any story (a recurring character/style reference shouldn't be
// re-uploaded per story) - owned by the user directly, not scoped to a
// single storyProjectId, the same reasoning as styleProfiles being global
// rather than per-project.
export const savedReferenceImages = pgTable("saved_reference_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  url: text("url").notNull(),
  // Free-text tags, not a separate tags table - this is a personal handful
  // of labels for @-mention lookup (StudioWorkspace.tsx), not a general
  // taxonomy that needs its own relational modeling.
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
