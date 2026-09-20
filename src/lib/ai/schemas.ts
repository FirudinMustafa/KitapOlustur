import { z } from "zod";

// ---- Source page map ----
// A page-by-page blueprint of the uploaded source PDF. This is what lets the
// pipeline mirror the source book's structure (cover, contents, unit pages...)
// page-for-page instead of just producing a free-form rewrite.

export const pageTypeEnum = z.enum([
  "cover",
  "contents",
  "unit_opener",
  "content",
  "exercise",
  "glossary",
  "review",
  "answer_key",
  "assessment",
  "back_cover",
  "other",
]);
export type PageType = z.infer<typeof pageTypeEnum>;

export const sourcePageSchema = z.object({
  pageNumber: z.number(),
  pageType: pageTypeEnum,
  unitNumber: z
    .number()
    .nullable()
    .describe("Which unit this page belongs to, or null if it isn't part of a unit (cover, contents, back cover, ...)"),
  summary: z.string().describe("What is on this page: text content, layout, purpose"),
  sourceText: z
    .string()
    .optional()
    .describe(
      "The page's substantive running text (headings, body copy, exercise prompts, dialogue) transcribed as closely as practical - not a paraphrase. Used later to check the generated book isn't reusing the source's actual wording. Omit for pages with no real body text (e.g. a mostly-blank divider).",
    ),
  hasImage: z.boolean(),
  imageDescription: z
    .string()
    .optional()
    .describe("If hasImage is true: describe the photo/illustration - subject, scene, style"),
});
export type SourcePage = z.infer<typeof sourcePageSchema>;

export const pageMapSchema = z.object({
  totalPages: z.number(),
  pages: z.array(sourcePageSchema),
});
export type PageMap = z.infer<typeof pageMapSchema>;

// ---- Outline ----
// Subject-agnostic: works for a language coursebook, a math textbook, etc.

export const unitOutlineSchema = z.object({
  number: z.number(),
  title: z.string(),
  level: z
    .string()
    .describe("Difficulty/level descriptor appropriate to the subject, e.g. 'CEFR A2' for a language, 'Grade 7' for math"),
  sourcePageRange: z.object({ start: z.number(), end: z.number() }),
  learningObjectives: z.array(z.string()),
  keyTerms: z.array(z.string()).describe("Key vocabulary, formulas, or concepts introduced in this unit"),
});
export type UnitOutline = z.infer<typeof unitOutlineSchema>;

export const bookOutlineSchema = z.object({
  bookTitle: z.string(),
  subject: z.string().describe("The academic subject/domain, e.g. 'English Language Teaching', 'Mathematics', 'Physics'"),
  contentLanguage: z.string().describe("BCP-47 language code of the book's content, e.g. 'en', 'tr'"),
  level: z.string().describe("Overall level or range, e.g. 'A2-B1' or 'Grade 6-7'"),
  tone: z.string(),
  targetAudience: z.string(),
  units: z.array(unitOutlineSchema),
  // Faz "Müfredat hizalaması" (2026-09-20, ROADMAP.md): projects.level is a
  // free-text field the user types at project creation, but nothing ever
  // checked it against what the source material actually turns out to be -
  // level (above) is derived purely from the PDF, with zero connection to
  // the user's stated intent. Only set when the user actually declared a
  // level; left unset otherwise (most runs, since the field is optional).
  declaredLevelAlignment: z
    .object({
      matches: z.boolean(),
      note: z.string().describe("Brief explanation, especially when matches=false - what the user declared vs what the material actually is"),
    })
    .optional(),
});
export type BookOutline = z.infer<typeof bookOutlineSchema>;

// ---- Improvement plan ----

export const unitImprovementPlanSchema = z.object({
  unitNumber: z.number(),
  improvements: z.array(z.string()),
});

export const improvementPlanSchema = z.object({
  overallNotes: z.string(),
  unitPlans: z.array(unitImprovementPlanSchema),
});
export type ImprovementPlan = z.infer<typeof improvementPlanSchema>;

// ---- Generated content ----
// Generic content blocks replace the old ESL-only sections/exercises so the
// same schema can hold a dialogue+exercise (language) or a worked example +
// problem set (math) equally well.

export const contentBlockKindEnum = z.enum([
  "explanation",
  "example",
  "practice",
  "assessment",
  "reference",
  "narrative",
]);
export type ContentBlockKind = z.infer<typeof contentBlockKindEnum>;

// Faz H2 Faz 3: structured, auto-checkable exercise types for the
// interactive web reader (BookReader.tsx). Deliberately a single new
// OPTIONAL field on contentBlockSchema, not a schema replacement - every
// existing field (items/answerKey/etc.) is untouched, so units generated
// before this existed still work exactly as before (PDF/EPUB/Common
// Cartridge/web reader all already have a `?? []`/optional-safe fallback
// path for a missing field). No regeneration of existing content is
// needed, unlike what the original roadmap note assumed before this was
// actually designed. Only "practice"/"assessment" kind blocks are expected
// to use this (the writer prompt says so) - it doesn't make sense for
// "explanation"/"narrative" blocks.
export const multipleChoiceSchema = z.object({
  type: z.literal("multiple_choice"),
  question: z.string(),
  options: z.array(z.string()).min(2),
  correctIndex: z.number().int().min(0),
});

export const fillBlankSchema = z.object({
  type: z.literal("fill_blank"),
  // The sentence/text with each blank marked as "___" (three underscores),
  // in order - e.g. "The cat ___ on the ___.". `blanks.length` must equal
  // the number of "___" markers in `template`.
  template: z.string(),
  blanks: z.array(z.string()).min(1),
});

export const matchingSchema = z.object({
  type: z.literal("matching"),
  pairs: z.array(z.object({ left: z.string(), right: z.string() })).min(2),
});

export const interactiveExerciseSchema = z.discriminatedUnion("type", [
  multipleChoiceSchema,
  fillBlankSchema,
  matchingSchema,
]);
export type InteractiveExercise = z.infer<typeof interactiveExerciseSchema>;

export const contentBlockSchema = z.object({
  kind: contentBlockKindEnum,
  heading: z.string(),
  body: z.string().describe("Main text. May include inline math notation like $x^2$ for numeric subjects."),
  items: z.array(z.string()).optional().describe("Numbered practice items, questions, or problems"),
  answerKey: z.array(z.string()).optional(),
  visualDescription: z
    .string()
    .optional()
    .describe("If this block should be accompanied by an illustration/diagram, describe it here"),
  interactive: interactiveExerciseSchema
    .optional()
    .describe(
      "For a practice/assessment block, an optional structured exercise (multiple_choice, fill_blank, or matching) the interactive web reader can render as a real, auto-checkable activity instead of static text. Leave unset for blocks that don't fit one of these three shapes - items/answerKey alone are fine.",
    ),
});
export type ContentBlock = z.infer<typeof contentBlockSchema>;

export const glossaryEntrySchema = z.object({
  term: z.string(),
  definition: z.string(),
  example: z.string().optional(),
});
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;

export const dialogueLineSchema = z.object({
  speaker: z.string().describe("The character/speaker's name, exactly as it appears in the script"),
  line: z.string(),
});
export type DialogueLine = z.infer<typeof dialogueLineSchema>;

export const wordTimestampSchema = z.object({
  word: z.string(),
  startMs: z.number(),
  endMs: z.number(),
});
export type WordTimestamp = z.infer<typeof wordTimestampSchema>;

export const listeningAudioSchema = z.object({
  blockRef: z.string().describe("Heading of the content block this audio script belongs to"),
  script: z.string(),
  // If this passage is a dialogue between two or more named speakers, the
  // same content broken into per-speaker turns, in order - lets each
  // speaker be synthesized with a distinct TTS voice instead of one
  // narrator reading everyone's lines. Absent/empty for a single-narrator
  // passage (monologue, story narration) - `script` alone is used then,
  // exactly as before this field existed.
  dialogueLines: z.array(dialogueLineSchema).optional(),
  audioUrl: z
    .string()
    .optional()
    .describe("Not set by the writer - filled in later once the script is synthesized into speech"),
  // Faz H2 Faz 2: not set by the writer either - filled in by
  // alignListeningAudio (workflows/book-pipeline.tsx) via forced alignment
  // (word-level transcription of the audio that was just synthesized from
  // this exact script). Powers the interactive reader's karaoke-style
  // word-by-word highlighting (BookReader.tsx). Absent if alignment failed
  // or hasn't run - the reader falls back to a plain <audio> player.
  wordTimestamps: z.array(wordTimestampSchema).optional(),
});
export type ListeningAudio = z.infer<typeof listeningAudioSchema>;

export const generatedPageSchema = z.object({
  sourcePageNumber: z.number(),
  pageType: pageTypeEnum,
  unitNumber: z.number().nullable(),
  blocks: z.array(contentBlockSchema),
  glossary: z.array(glossaryEntrySchema).optional(),
  imagePrompt: z
    .string()
    .optional()
    .describe(
      "If this page should carry an illustration, a prompt for an image generator - inspired by the source page's imagery but reimagined as new, original artwork, not a copy",
    ),
});
export type GeneratedPage = z.infer<typeof generatedPageSchema>;

export const generatedUnitSchema = z.object({
  unitNumber: z.number(),
  title: z.string(),
  studentBookPages: z.array(generatedPageSchema),
  workbookPages: z.array(generatedPageSchema),
  teacherBookPages: z.array(generatedPageSchema).optional(),
  testBookletPages: z.array(generatedPageSchema).optional(),
  glossary: z.array(glossaryEntrySchema),
  listeningAudio: z.array(listeningAudioSchema).optional(),
});
export type GeneratedUnit = z.infer<typeof generatedUnitSchema>;

// A single unit is generated in two smaller calls (mirrored source-side +
// complementary side) instead of one large call, so a rich unit's output
// doesn't risk exceeding the model's output token budget mid-JSON.

export const generatedMirroredSideSchema = z.object({
  pages: z.array(generatedPageSchema),
  glossary: z.array(glossaryEntrySchema),
  listeningAudio: z.array(listeningAudioSchema).optional(),
});
export type GeneratedMirroredSide = z.infer<typeof generatedMirroredSideSchema>;

export const generatedComplementarySideSchema = z.object({
  pages: z.array(generatedPageSchema),
});
export type GeneratedComplementarySide = z.infer<typeof generatedComplementarySideSchema>;

// A shared "style bible" built once per book, after the outline is approved,
// so units - each written in an independent AI call - stay consistent with
// each other (same character names/setting, same terminology).
export const styleBibleSchema = z.object({
  charactersAndSetting: z
    .string()
    .describe("Shared characters, setting/world, and narrative context to reuse consistently across all units"),
  terminology: z
    .array(z.object({ term: z.string(), definition: z.string() }))
    .describe("Key recurring terms/formulas and their definitions, to keep usage consistent across units"),
});
export type StyleBible = z.infer<typeof styleBibleSchema>;

export const unitReviewSchema = z.object({
  unitNumber: z.number(),
  passed: z.boolean(),
  issues: z.array(z.string()),
});
export type UnitReview = z.infer<typeof unitReviewSchema>;

// ---- Image QA (Faz D) ----
// Checks a generated illustration against the prompt that produced it and the
// page it will appear on, so bad or mismatched art can be retried or flagged
// for manual review instead of silently shipping in the assembled book.
export const imageReviewSchema = z.object({
  passed: z.boolean(),
  issues: z.array(z.string()),
  suggestedPromptFix: z
    .string()
    .optional()
    .describe("If passed=false, a revised image prompt that addresses the issues, for a retry attempt"),
});
export type ImageReview = z.infer<typeof imageReviewSchema>;

// ---- Book-wide coherence review (Faz E) ----
// Runs once, after every unit has been generated, to catch cross-unit
// pedagogical problems that a per-unit reviewUnit call structurally cannot
// see: difficulty progression, vocabulary repetition/spacing, grammar
// sequencing, and thematic consistency across the whole book.
export const coherenceIssueSchema = z.object({
  unitNumber: z.number(),
  category: z.enum(["difficulty", "vocabulary", "grammar", "theme"]),
  description: z.string(),
  severity: z.enum(["low", "medium", "high"]),
});
export type CoherenceIssue = z.infer<typeof coherenceIssueSchema>;

export const bookCoherenceReviewSchema = z.object({
  passed: z.boolean(),
  difficultyProgressionScore: z.number().min(0).max(100),
  vocabularyRepetitionScore: z.number().min(0).max(100),
  grammarSequencingScore: z.number().min(0).max(100),
  thematicConsistencyScore: z.number().min(0).max(100),
  issues: z.array(coherenceIssueSchema),
});
export type BookCoherenceReview = z.infer<typeof bookCoherenceReviewSchema>;

// ---- Faz F2: LLM-assisted originality second opinion ----
// F1 (src/lib/originality.ts) is a cheap, deterministic n-gram overlap
// score - good at catching verbatim copying but blind to "structural"
// closeness (same sentence-by-sentence structure with just words swapped)
// and prone to false positives on generic phrasing/common terminology that
// legitimately recurs in any textbook on the same topic. F2 only runs on
// pages F1 already flagged (keeps the added LLM cost proportional to actual
// risk) and gives a second, more contextual opinion a human reviewer can
// weigh alongside the raw score. Like F1, this is a risk signal for manual
// review, not a legal determination.
export const originalityLlmAssessmentSchema = z.object({
  similarityLevel: z
    .enum(["low", "medium", "high"])
    .describe(
      "Overall closeness to the source beyond simple word overlap - considers sentence structure, ordering, and whether reused phrasing is generic/unavoidable topic terminology vs. distinctively copied wording",
    ),
  rationale: z.string().describe("1-2 sentence explanation of the verdict"),
  concerningPhrases: z
    .array(z.string())
    .describe("Specific phrases/sentences reused near-verbatim from the source that a human should look at, if any - empty if none"),
});
export type OriginalityLlmAssessment = z.infer<typeof originalityLlmAssessmentSchema>;
