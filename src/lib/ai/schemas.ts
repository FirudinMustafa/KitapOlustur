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
});
export type ContentBlock = z.infer<typeof contentBlockSchema>;

export const glossaryEntrySchema = z.object({
  term: z.string(),
  definition: z.string(),
  example: z.string().optional(),
});
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;

export const listeningAudioSchema = z.object({
  blockRef: z.string().describe("Heading of the content block this audio script belongs to"),
  script: z.string(),
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

export const unitReviewSchema = z.object({
  unitNumber: z.number(),
  passed: z.boolean(),
  issues: z.array(z.string()),
});
export type UnitReview = z.infer<typeof unitReviewSchema>;
