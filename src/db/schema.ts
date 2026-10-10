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
  "awaiting_logo_upload",
  "awaiting_character_approval",
  "awaiting_variant_selection",
  "generating",
  "reviewing",
  "awaiting_content_approval",
  "generating_images",
  "awaiting_image_review",
  "reviewing_coherence",
  "reviewing_design",
  "awaiting_final_approval",
  "assembling",
  "done",
  "changes_requested",
  "failed",
]);
export type RunStatus = (typeof runStatusEnum.enumValues)[number];

export type PrintReport = {
  pageCount: number;
  spineMm: number;
  bleedMm: number;
  trimSize: string;
  images: number;
  upscaledImages: number;
  smallestNativeWidthPx: number | null;
  targetWidthPx: number;
};

export type CoverMockup = {
  /** The cover wrap (back + spine + front, with bleed) rendered as an image. */
  imageUrl: string;
  trimWidthPt: number;
  trimHeightPt: number;
  spinePt: number;
  bleedPt: number;
};

export type CharacterSheet = { id: string; name: string; role: string; visualDescription: string; outfit: string; imageUrl: string | null };
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

// Yapılandırılabilir Trim Size (Baskı Boyutu) (2026-09-21, ROADMAP.md):
// default "a4" so existing behavior (and existing rows, once backfilled) is
// unchanged unless a user picks a real print trim size at project creation.
// See src/lib/pdf/page-geometry.ts's TRIM_SIZES for the pt dimensions.
export const trimSizeEnum = pgEnum("trim_size", ["a4", "6x9", "7x10"]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  level: text("level"),
  // Faz "ISBN/baskıya hazırlık" (2026-09-20, ROADMAP.md): optional, only
  // meaningful for a project the user actually intends to print/publish.
  // Validated (ISBN-13 checksum, see src/lib/isbn.ts) before being saved -
  // never auto-generated, this has to be a real ISBN the user owns/bought.
  isbn: text("isbn"),
  // Yapılandırılabilir Trim Size (Baskı Boyutu): chosen once at project
  // creation, no edit-after-creation UI - see page-geometry.ts's TRIM_SIZES
  // and the "kapsam dışı" note in ROADMAP.md about why LayoutEditor.tsx/
  // BookReader.tsx stay fixed at A4 regardless of this value.
  trimSize: trimSizeEnum("trim_size").notNull().default("a4"),
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
  // Faz "Sabit Ünite İskeleti" (2026-09-21, ROADMAP.md): when set (non-empty),
  // opts a run OUT of the default "mirror the source PDF's own page
  // structure" generation (generateMirroredSide) and into a user-defined,
  // fixed section order per unit (generateSkeletonSide) - e.g.
  // ["Dilbilgisi", "Kelime", "Okuma", "Dinleme", "Konuşma", "Tekrar"]. Null/
  // empty (the default, unchanged behavior for every existing run) means
  // mirror-based generation exactly as before this existed.
  unitSkeleton: jsonb("unit_skeleton").$type<string[] | null>(),
  // "Sıfırdan Kitap" modu (2026-09-22): when true, this run has NO real
  // source PDF - fetchRunContext still finds a sourceUploads row (a
  // synthesized placeholder inserted by POST /api/projects, see that
  // route), but the pipeline replaces extractPageMap+extractOutline with
  // generateOutlineFromBrief (workflows/book-pipeline.tsx), forces the
  // unitSkeleton-style per-unit generation path (there are no real source
  // pages to mirror), and skips checkOriginality (nothing to compare
  // against). Kept as its own boolean rather than overloading unitSkeleton,
  // since unitSkeleton means "custom section order while still mirroring a
  // real PDF" - a different axis (unit structure) from this (outline
  // origin). unitLimit doubles as "how many units to generate" in this mode.
  isFromScratch: boolean("is_from_scratch").notNull().default(false),
  // Only meaningful when isFromScratch is true - a short optional brief the
  // user typed to steer generateOutlineFromBrief (e.g. "focus on everyday
  // conversation, not grammar drills"). Null means "no brief, use judgment".
  scratchBrief: text("scratch_brief"),
  // Aralıklı Tekrar (Spaced Repetition) Sayfaları (2026-09-21, ROADMAP.md):
  // opt-in, default false (unchanged behavior for every existing run) -
  // when true, every REVIEW_INTERVAL_UNITS-th real unit
  // (workflows/book-pipeline.tsx) gets extra "Tekrar" recap/practice pages
  // appended to its own studentBookPages/workbookPages, reinforcing key
  // terms from the preceding units.
  spacedRepetition: boolean("spaced_repetition").notNull().default(false),
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
  // "Kaynağa görsel sadakat" (2026-09-28, ROADMAP.md): set once, after the
  // awaiting_logo_upload hook resolves - null means either no logo was
  // detected in the source or the user explicitly skipped uploading one.
  // Persisted (not a pendingX scratch column) because BookDocument.tsx
  // needs it at final assembly time, long after the hook itself resolved.
  userLogoUrl: text("user_logo_url"),
  // Same "Kaynağa görsel sadakat" feature as userLogoUrl above - persisted
  // alongside it so the web reader (BookReader.tsx) can render the same
  // logo placement/palette the PDF export already uses, instead of only
  // BookDocument.tsx seeing this data as a transient pageMap-derived value.
  logoPosition: text("logo_position"),
  paletteColors: jsonb("palette_colors").$type<string[]>(),
  pageImageUrls: jsonb("page_image_urls").$type<Record<number, string>>(),
  // Faz 1 "Tasarım sistemi": visual theme id (src/lib/design/themes.ts) the
  // PDF and web reader render with. Null = "classic", the look every book
  // had before themes existed, so older runs re-assemble unchanged.
  designTheme: text("design_theme"),
  // Faz 2 "İllüstrasyon stili": art direction id (src/lib/ai/art-styles.ts)
  // appended to every image prompt. Null = "textbook", the original style.
  artStyle: text("art_style"),
  // Faz 2 "Karakter tutarlılığı": one reference image per recurring
  // character, generated after the style bible and approved by a human
  // (awaiting_character_approval). Every illustration showing a character
  // is generated with that character's sheet as a reference image.
  characterSheets: jsonb("character_sheets").$type<CharacterSheet[]>(),
  // Scratch column while awaiting_character_approval: which hook round is
  // open (same numbered-token pattern as pendingContentApproval).
  pendingCharacterApproval: jsonb("pending_character_approval").$type<{ round: number } | null>(),
  // Faz 3 "Referans kitapla kıyas": page images (PNG/JPEG Blob URLs, PDFs
  // already rasterised) from a published book the user wants to match. The
  // design review grades every typeset page against them.
  referencePageUrls: jsonb("reference_page_urls").$type<string[]>(),
  // Faz 6 "Resimli hikâye kitabı": "picturebook" runs write one illustrated
  // story (a single unit whose pages are full-page pictures with short text)
  // instead of a coursebook. Null = "coursebook".
  bookKind: text("book_kind"),
  pictureBookPageCount: integer("picture_book_page_count"),
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

// Faz 3 "Görsel sayfa denetimi": one row per typeset page per review
// round - the art-director grade of the page as it actually prints.
export const pageDesignReviews = pgTable("page_design_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => generationRuns.id, { onDelete: "cascade" }),
  round: integer("round").notNull().default(1),
  bookType: bookTypeEnum("book_type").notNull(),
  pdfPage: integer("pdf_page").notNull(),
  // Null for the cover / answer key.
  unitNumber: integer("unit_number"),
  pageIndex: integer("page_index"),
  // PDF pages this logical page occupied (>1 = it spilled).
  pageCount: integer("page_count").notNull().default(1),
  score: integer("score").notNull(),
  issues: jsonb("issues").$type<{ type: string; severity: "minor" | "major"; description: string }[]>().notNull().default([]),
  suggestedFix: text("suggested_fix").notNull().default("none"),
  appliedFix: text("applied_fix"),
  referenceGap: text("reference_gap"),
  imageUrl: text("image_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type PageDesignReviewRow = typeof pageDesignReviews.$inferSelect;

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
// Süreç Günlüğü: an append-only history of a run - every status change the
// pipeline makes (setRunStatus) and every decision the human takes at an
// approval gate. generation_runs only holds the CURRENT status, so without
// this the path a run took (and how long each stage took) was lost.
export const runEvents = pgTable("run_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => generationRuns.id, { onDelete: "cascade" }),
  // "status" (pipeline) or "human" (an approval decision).
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type RunEventRow = typeof runEvents.$inferSelect;

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
  // Faz 4 "Baskıya hazır çıktı": interior with 3 mm bleed and no cover, the
  // matching back+spine+front cover wrap, and what was measured for them.
  printPdfBlobUrl: text("print_pdf_blob_url"),
  coverSpreadBlobUrl: text("cover_spread_blob_url"),
  printReport: jsonb("print_report").$type<PrintReport>(),
  // Faz 5 "3D önizleme": every page of the screen PDF as an image (the 3D
  // reader's page textures) plus the cover wrap as an image with its
  // geometry (the 3D mockup's cover/spine/back texture).
  pageRenderUrls: jsonb("page_render_urls").$type<string[]>(),
  coverMockup: jsonb("cover_mockup").$type<CoverMockup>(),
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
