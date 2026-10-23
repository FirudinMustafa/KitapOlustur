import type { SourcePageLayout } from "@/lib/source-layout";
import { z } from "zod";
import { ACTIVITY_TYPES } from "@/lib/activities";
import { MAP_MAX_COLS, MAP_MAX_ROWS, PREPOSITIONS } from "@/lib/diagrams";
import { LAYOUT_TEMPLATE_IDS } from "@/lib/design/layouts";
import { MAX_TYPE_PICTURES, PAGE_LAYOUT_TYPES } from "@/lib/design/page-types";
import { TEXT_STYLES } from "@/lib/text-style";

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

// "Kaynağa görsel sadakat" (2026-09-28, ROADMAP.md): the source PDF is
// already sent to the model as a `file` part (see extractPageMap in
// book-pipeline.tsx), so the model can already see its visual design - this
// schema just asks it to also report what it sees, so the generated book
// can be reskinned with the source's actual color palette/logo/density
// instead of always falling back to the pipeline's generic fixed template.
// Deliberately scoped to only what BookDocument.tsx can safely reuse
// without copying the source's actual design (border/frame pattern,
// footer/header wording) - those are left out on purpose, per user
// decision, to avoid replicating a copyrighted source's literal layout.
export const sourceVisualStyleSchema = z.object({
  dominantColors: z
    .array(z.string())
    .max(4)
    .optional()
    .describe("This page's dominant colors (background, accent bars, headings) - hex codes if legible, plain English color names otherwise"),
  hasBrandMark: z.boolean().describe("Whether a logo/brand mark (not a content photo) appears on this page"),
  brandMarkPosition: z
    .enum(["top_left", "top_right", "bottom_left", "bottom_right", "top_center", "bottom_center", "other"])
    .nullable()
    .optional()
    .describe("Roughly where the brand mark sits, if hasBrandMark is true"),
  layoutDensity: z
    .enum(["compact", "moderate", "spacious"])
    .optional()
    .describe("Compact worksheet-style page packing vs. spacious textbook-style whitespace"),
  // Faz B ("kaynağa yakın bölge-tabanlı mirroring", 2026-09-28): a coarse,
  // named "where does the image/text sit" template - not pixel coordinates.
  // Faz B1: overwritten with the zone measured from the PDF
  // (src/lib/source-layout.ts) - the model's own guess only survives for
  // runs extracted before that.
  layoutZone: z
    .enum([
      "image_top_text_bottom",
      "image_bottom_text_top",
      "image_left_text_right",
      "image_right_text_left",
      "two_column",
      "full_width_text",
      "full_width_image",
    ])
    .optional()
    .describe("This page's coarse image/text arrangement - the closest match, not a precise measurement"),
});
export type SourceVisualStyle = z.infer<typeof sourceVisualStyleSchema>;

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
  visualStyle: sourceVisualStyleSchema.optional(),
});
// `layout` is measured from the PDF itself (src/lib/source-layout.ts), never
// asked of the model - so it is not part of the schema above.
export type SourcePage = z.infer<typeof sourcePageSchema> & { layout?: SourcePageLayout };

export const pageMapSchema = z.object({
  totalPages: z.number(),
  pages: z.array(sourcePageSchema),
});
export type PageMap = { totalPages: number; pages: SourcePage[] };

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
  // Faz B5: the contents page's skills matrix, as a published coursebook
  // prints it. Optional - outlines extracted before it simply lack it.
  grammar: z
    .array(z.string())
    .optional()
    .describe("Grammar points of the unit, short (e.g. \"Present Simple\", \"can / can't\"). Empty for non-language subjects."),
  skills: z
    .array(z.string())
    .optional()
    .describe("The unit's skills work, each prefixed with the skill (e.g. \"Reading: a dialogue\", \"Listening: matching\", \"Writing: an email\")."),
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

// Faz "Sayfa Dizilimi Editörü": not written by the writer model - only ever
// set by the LayoutEditor's save flow (src/lib/layout-merge.ts). Coordinates
// are in PDF points (src/lib/pdf/page-geometry.ts is the single source of
// truth both BookDocument.tsx's react-pdf render and the editor's canvas
// derive from), so no px<->pt conversion drift is possible between what the
// user positioned and what actually renders. Absent (the common case, for
// every block generated before this existed and every block never manually
// positioned) means "render in normal document flow, exactly as before" -
// every renderer (BookDocument.tsx, BookReader.tsx) falls back to that flow
// when this is unset. EPUB/DOCX/Common Cartridge intentionally ignore this
// field entirely (see content-html.ts/BookDocx.ts) - reflowable EPUB and
// Word's sequential model can't host arbitrary absolute placement.
export const blockLayoutSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BlockLayout = z.infer<typeof blockLayoutSchema>;

export const contentBlockSchema = z.object({
  kind: contentBlockKindEnum,
  heading: z.string(),
  body: z
    .string()
    .describe(
      "Main text, as plain prose only - no Markdown syntax (no **bold**, no # headings, no bullet dashes). May include inline math notation like $x^2$ for numeric subjects. Never include internal authoring labels like \"Visual Brief:\" or image/audio generation instructions here - those belong only in visualDescription/imagePrompt/listeningAudio, not in reader-facing body text.",
    ),
  items: z.array(z.string()).optional().describe("Numbered practice items, questions, or problems"),
  answerKey: z
    .array(z.string())
    .optional()
    .describe(
      'If this block has "items", the correct answer for each item, in the same order and count as items - never leave this empty when items is non-empty.',
    ),
  visualDescription: z
    .string()
    .optional()
    .describe("If this block should be accompanied by an illustration/diagram, describe it here"),
  interactive: interactiveExerciseSchema
    .optional()
    .describe(
      "For a practice/assessment block, an optional structured exercise (multiple_choice, fill_blank, or matching) the interactive web reader can render as a real, auto-checkable activity instead of static text. Leave unset for blocks that don't fit one of these three shapes - items/answerKey alone are fine.",
    ),
  layout: blockLayoutSchema
    .optional()
    .describe("Not set by the writer - leave unset. Only ever filled in later by the layout editor's save flow."),
  // Faz 1 "Tasarım sistemi": optional presentation fields - all additive, so
  // every block generated before they existed renders exactly as before.
  callout: z
    .enum(["tip", "did_you_know", "remember", "grammar"])
    .optional()
    .describe(
      'Set ONLY for a short side note that should print as a coloured callout box (a study tip, a fun fact, a "remember" rule, a compact grammar rule). Keep its body under ~300 characters. Leave unset for normal blocks.',
    ),
  // Artefacts: a short text a coursebook sets as a designed object, not
  // prose (src/lib/text-style.ts; blocks without it are recognised from
  // their text there). A plain enum, like callout.
  textStyle: z
    .enum(TEXT_STYLES)
    .optional()
    .describe(
      "Set ONLY when this block's body IS such a text, to print it as one: an email or letter (email), a short text message (message), a handwritten note (note), a party invitation (invitation), a quiz with A/B options in its items (quiz), a poster or advert (poster). Gaps and items still print. Leave unset for instructions, exercises and normal reading texts.",
    ),
  dialogue: z
    .array(z.object({ speaker: z.string(), line: z.string() }))
    .optional()
    .describe(
      "If this block IS a conversation between named characters, the turns in order (speaker name + what they say). Prints as speech bubbles. Do not also repeat the conversation in body - body is then a one-line lead-in only.",
    ),
  table: z
    .object({ headers: z.array(z.string()).min(1), rows: z.array(z.array(z.string())).min(1) })
    .optional()
    .describe(
      "For grammar/conjugation/comparison content that is naturally a table (e.g. subject | verb | example). Each row has exactly one cell per header. Never put an exercise's answers in its table - the items are the questions and the answers belong only in answerKey.",
    ),
  // Print-workbook activity formats (src/lib/activities.ts). Additive:
  // a block without it prints as the numbered list it always did.
  activity: z
    .object({
      type: z.enum(ACTIVITY_TYPES),
      words: z.array(z.string()).optional().describe("Word bank: the words printed in a box for learners to choose from."),
      pictures: z
        .array(
          z.object({
            label: z.string().describe("What the picture shows, in a few plain words."),
            emoji: z.string().optional().describe("ONE emoji character that depicts it, e.g. 📚 - used to draw the picture."),
          }),
        )
        .optional()
        .describe("picture_label / picture_match: one picture per item."),
      lines: z.number().int().min(1).max(12).optional().describe("write_lines: ruled lines per item (or for a free-writing task); draw_box: frame height in lines."),
    })
    .optional()
    .describe(
      `Optional workbook activity format: ${ACTIVITY_TYPES.join(", ")}. Leave unset for a plain numbered exercise.`,
    ),
  // Code-drawn diagrams (src/lib/diagrams.ts) - additive like `activity`.
  diagram: z
    .object({
      type: z.enum(["prepositions", "map"]),
      scenes: z.array(z.enum(PREPOSITIONS)).optional().describe("prepositions: one scene per item, in item order."),
      places: z
        .array(
          z.object({
            name: z.string(),
            emoji: z.string().optional().describe("ONE emoji that depicts the place."),
            row: z.number().int().min(1).max(MAP_MAX_ROWS),
            col: z.number().int().min(1).max(MAP_MAX_COLS),
          }),
        )
        .optional()
        .describe("map: the places on the street grid, one per cell."),
    })
    .optional()
    .describe("Optional exact diagram drawn by the software: preposition scenes (ball and box) or a town map. Leave unset otherwise."),
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

// Faz B2: see src/lib/design/zones.ts.
const zoneColumnItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("picture"), height: z.number() }),
  z.object({ kind: z.literal("text"), weight: z.number() }),
]);
const zoneBandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pictures"), height: z.number(), widths: z.array(z.number()) }),
  z.object({ kind: z.literal("split"), side: z.enum(["left", "right"]), imageWidth: z.number(), height: z.number(), pictures: z.number() }),
  z.object({ kind: z.literal("text"), columns: z.union([z.literal(1), z.literal(2)]), weight: z.number() }),
  z.object({
    kind: z.literal("columns"),
    columns: z.tuple([z.array(zoneColumnItemSchema), z.array(zoneColumnItemSchema)]),
  }),
]);
export const zonePlanSchema = z.object({ bands: z.array(zoneBandSchema) });

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
  // Faz B3: a source page often carries several pictures (a vocabulary row,
  // a scene beside a dialogue). imagePrompt is the first; these are the rest.
  // Up to MAX_TYPE_PICTURES: a card page has one per card (page-types.ts);
  // zone-plan pages are trimmed to their frames by applyZonePlans. Never
  // more than 10 - extraImageKey(n, 11) is page n+1's extra picture 1.
  extraImagePrompts: z
    .array(z.string())
    .max(MAX_TYPE_PICTURES)
    .optional()
    .describe(
      "Only when this page's plan calls for more than one picture: prompts for the additional pictures, in reading order (imagePrompt is the first picture). Each a separate, simple subject that fits a small frame.",
    ),
  // Faz "Sabit Ünite İskeleti" (2026-09-21, ROADMAP.md): only set when this
  // page was generated by generateSkeletonSide (workflows/book-pipeline.tsx)
  // from a user-defined section name (e.g. "Dinleme") instead of mirroring a
  // real source PDF page - undefined for every page generated the normal
  // (mirror-based) way. Purely descriptive/orthogonal to `pageType` (which
  // stays a generic layout-role value like "content" for skeleton pages too)
  // - deliberately not a new pageType enum value, to avoid touching every
  // existing `pageType === "..."` check across the codebase.
  sectionLabel: z.string().optional(),
  // Faz "Sayfa Dizilimi Editörü": same rationale as contentBlockSchema's
  // `layout` - only set by the layout editor's save flow, positions the
  // page's own illustration (looked up separately via pageImages, keyed by
  // sourcePageNumber) instead of its default "full-width, above all blocks"
  // placement.
  imageLayout: blockLayoutSchema
    .optional()
    .describe("Not set by the writer - leave unset. Only ever filled in later by the layout editor's save flow."),
  // "Dizilim → Gerçek Kitap" (2026-09-23): only ever set by moveImage
  // (src/lib/arrangement-merge.ts), never by the writer model. A page's
  // image is normally looked up as pageImages[page.sourcePageNumber] (see
  // src/lib/page-image.ts's resolvePageImageUrl, the single place every
  // renderer - PDF, EPUB, DOCX, reader, editor - reads a page's image from).
  // This field overrides that lookup key: a number means "show the image
  // from THAT sourcePageNumber instead" (the image was dragged in from
  // another page); explicit null means "no image here even though
  // pageImages has an entry for this page's own sourcePageNumber" (the
  // image was dragged AWAY to another page). Absent (undefined, the common
  // case) means unchanged default behavior.
  imageOverrideSourcePageNumber: z.number().nullable().optional(),
  // Faz 1 "Tasarım sistemi": which page design this page uses - see
  // src/lib/design/layouts.ts. Absent on every page generated before
  // templates existed; renderers then use the original single-column flow.
  // Faz 2 "Karakter tutarlılığı": which style-bible characters appear in
  // this page's illustration (their ids) - their reference sheets are sent
  // to the image model so they look the same on every page.
  imageCharacters: z
    .array(z.string())
    .optional()
    .describe("If imagePrompt shows any of the style bible's characters, their ids (e.g. [\"leo\", \"ayse\"]). Empty/unset when no recurring character is in the picture."),
  layoutTemplate: z
    .enum(LAYOUT_TEMPLATE_IDS)
    .optional()
    .describe("The page design template for this page - pick from the catalogue given in the instructions."),
});
// What is stored and edited: the writer's page plus fields only the system
// sets. Faz B2's zonePlan (copied from the source page's measured layout)
// lives here, NOT in generatedPageSchema - that schema is sent to the
// writer model, and Gemini rejected the plan's numeric literals and tuple
// outright (live test 2026-10-12: every unit failed with HTTP 400).
export const storedPageSchema = generatedPageSchema.extend({
  zonePlan: zonePlanSchema.optional(),
  // The measured source page's numbered exercises and pictures, checked by
  // validateUnitStructure (src/lib/source-shape.ts); items = items per
  // exercise, the length topUpExercises brings short exercises up to;
  // words = the printed page's word count, a hard budget (wordBudgetIssue).
  // pageType = the source page's picture layout - scene, cards, panels or
  // mixed (src/lib/design/page-types.ts), set by applyZonePlans; the PDF
  // sets the three picture types with their own templates. It sits in
  // sourceShape because the page's top-level `pageType` is already its
  // cover/content/exercise role.
  sourceShape: z
    .object({
      exercises: z.number(),
      pictures: z.number(),
      items: z.number().optional(),
      words: z.number().optional(),
      pageType: z.enum(PAGE_LAYOUT_TYPES).optional(),
    })
    .optional(),
  // Plan step 4: words printed on a scene's main picture (source p.7's
  // "window", "door" pills). x, y = where the label's arrow points, as
  // fractions (0-1) of the picture; set by locateLabels after the picture
  // is made, never by the writer.
  labels: z.array(z.object({ word: z.string(), x: z.number(), y: z.number() })).optional(),
});
export type GeneratedPage = z.infer<typeof storedPageSchema>;

export const generatedUnitSchema = z.object({
  unitNumber: z.number(),
  title: z.string(),
  studentBookPages: z.array(storedPageSchema),
  workbookPages: z.array(storedPageSchema),
  teacherBookPages: z.array(storedPageSchema).optional(),
  testBookletPages: z.array(storedPageSchema).optional(),
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
  // Faz 2 "Karakter tutarlılığı": the recurring cast, described precisely
  // enough to draw. Each one gets a reference sheet image that every later
  // illustration of them is generated from (see generateCharacterSheets).
  characters: z
    .array(
      z.object({
        id: z.string().describe("Short stable slug, e.g. 'leo'"),
        name: z.string(),
        role: z.string().describe("Who they are in the book, e.g. 'student, 11, curious and funny'"),
        visualDescription: z
          .string()
          .describe(
            "Exact, drawable appearance: age, build, skin tone, face shape, hair (colour, length, style), eye colour, distinguishing features. Concrete enough that two artists would draw the same person.",
          ),
        outfit: z.string().describe("Their usual clothes with specific colours, kept the same throughout the book"),
      }),
    )
    .max(6)
    .optional()
    .describe("The book's recurring characters (2-6). Empty when the subject has no recurring cast."),
});
export type StyleBible = z.infer<typeof styleBibleSchema>;
export type StyleBibleCharacter = NonNullable<StyleBible["characters"]>[number];

// Faz 6 "Resimli hikâye kitabı": one spread-worthy moment per page.
export const pictureBookPagesSchema = z.object({
  pages: z.array(
    z.object({
      text: z.string().describe("The words printed on this page - short, read-aloud friendly, age-appropriate (usually 1-3 sentences)"),
      imagePrompt: z
        .string()
        .describe("The full-page illustration for this moment: setting, action, expressions, composition. Leave calm space at the bottom for the text."),
      imageCharacters: z.array(z.string()).describe("Ids of the style-bible characters visible in the illustration"),
    }),
  ),
});
export type PictureBookPages = z.infer<typeof pictureBookPagesSchema>;

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
