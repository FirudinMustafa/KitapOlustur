import { isExerciseBlock } from "@/lib/design/layouts";
import { zonePictureCount, type ZonePlan } from "@/lib/design/zones";
import type { PageLayoutType } from "@/lib/design/page-types";

// Live test 2026-10-12 (free Gemini writer): told "this source page has 5
// numbered exercises and 2 pictures", it wrote 1-2 exercises and no picture
// prompts - so the page lost both the source's density and its layout.
// The measured shape is now checked like the answer keys are: a page far
// below its source's exercise count, or without prompts for the pictures
// its layout has frames for, is sent back to the writer; pictures still
// missing after that are filled in from the page's own content.

export type SourceShape = { exercises: number; pictures: number; items?: number; words?: number; pageType?: PageLayoutType };

type TextBlock = {
  heading?: string;
  body?: string;
  items?: string[];
  dialogue?: { line: string }[];
  callout?: string;
  table?: { headers: string[]; rows: string[][] };
  activity?: { words?: string[] };
};

// How a page's words are counted. hideTips: the book hides teacher-facing
// "tip" callouts (young learners' pupil books, BookDocument.tsx), so they
// don't print and don't count against the page's budget.
export type WordCountOptions = { hideTips?: boolean };

type ShapedPage = {
  sourcePageNumber: number;
  blocks: (Parameters<typeof isExerciseBlock>[0] & TextBlock)[];
  imagePrompt?: string;
  extraImagePrompts?: string[];
  zonePlan?: ZonePlan | null;
  sourceShape?: SourceShape;
  glossary?: { term: string }[];
};

// At least this share of the source's numbered exercises must be there
// (Faz G4: was 0.6 - pages came out a third short of their source; the
// top-up step fills the rest).
const MIN_EXERCISE_SHARE = 0.8;

export function shapeIssues(page: ShapedPage, label: string, wordOptions: WordCountOptions = {}): string[] {
  const issues: string[] = [];
  const shape = page.sourceShape;
  if (shape && shape.exercises >= 2) {
    const have = page.blocks.filter(isExerciseBlock).length;
    const need = Math.max(2, Math.round(shape.exercises * MIN_EXERCISE_SHARE));
    if (have < need) {
      issues.push(
        `${label}, page ${page.sourcePageNumber}: the source page has ${shape.exercises} numbered exercises but this page has ${have}. Write ${shape.exercises} short exercise blocks (each with items and a matching answerKey), keeping the page's topic - shorten the other text if needed so it still fits.`,
      );
    }
  }
  const frames = pictureFrames(page);
  const prompts = (page.imagePrompt ? 1 : 0) + (page.extraImagePrompts?.filter((p) => p.trim()).length ?? 0);
  if (frames > 0 && prompts < frames) {
    issues.push(
      `${label}, page ${page.sourcePageNumber}: the source page has ${frames} pictures; set imagePrompt (the main scene) and ${frames - 1} extraImagePrompts (simple single subjects from this page, e.g. its vocabulary).`,
    );
  }
  const words = wordBudgetIssue(page, label, wordOptions);
  if (words) issues.push(words);
  return issues;
}

const words = (text: string | undefined) => (text ?? "").split(/\s+/).filter(Boolean).length;

const sum = (texts: string[] | undefined) => (texts ?? []).reduce((n, t) => n + words(t), 0);

// The printed words of one block: heading, instruction, items, speech, and
// the word bank and table cells, which print as well.
export function blockWordCount(b: TextBlock): number {
  return (
    words(b.heading) +
    words(b.body) +
    sum(b.items) +
    sum(b.dialogue?.map((d) => d.line)) +
    sum(b.activity?.words) +
    (b.table ? sum(b.table.headers) + b.table.rows.reduce((n, r) => n + sum(r), 0) : 0)
  );
}

export function blockPrints(b: TextBlock, options: WordCountOptions = {}): boolean {
  return !(options.hideTips && b.callout === "tip");
}

// The printed words on a generated page, counted the way the source page
// was measured (its whole text layer: headings, instructions, items, speech,
// word banks, tables). Page furniture (band, footer, folio) is left out on
// both sides: the source measure drops lines repeated in the bands.
export function pageWordCount(page: { blocks: TextBlock[] }, options: WordCountOptions = {}): number {
  return page.blocks.filter((b) => blockPrints(b, options)).reduce((n, b) => n + blockWordCount(b), 0);
}

// KIYAS-13 (live, 2026-10-21): told "words: 11" for a Pre-A1 page as a soft
// "within about 25%", the writer wrote 86 - and 72-201 words against the
// source's 11-38 on every page. The text pushed pictures down to a quarter
// of the page and ran pages over. The source's word count is now a hard
// budget like its exercise count: a page over it goes back to the writer.
export function wordBudget(sourceWords: number): number {
  return Math.round(Math.max(sourceWords * 1.5, sourceWords + 20));
}

// The page's word budget, or null where the source page set none.
export function pageWordBudget(page: { sourceShape?: SourceShape }): number | null {
  const source = page.sourceShape?.words;
  return source === undefined ? null : wordBudget(source);
}

export function wordBudgetIssue(page: ShapedPage, label: string, options: WordCountOptions = {}): string | null {
  const source = page.sourceShape?.words;
  if (source === undefined) return null;
  const have = pageWordCount(page, options);
  const budget = wordBudget(source);
  if (have <= budget) return null;
  return `${label}, page ${page.sourcePageNumber}: the page has ${have} words, but the source page has only ${source} - at most ${budget} words. Cut it down: one short instruction line per exercise, short items (a word or a short phrase), no explanatory paragraphs or extra boxes. The pictures carry the page.`;
}

// Deterministic backstop: picture prompts for every frame of the page's
// layout. The main scene comes from the page text; extra frames picture the
// page's own vocabulary (glossary terms, then exercise headings).
export function fillZonePictures<P extends ShapedPage>(page: P, mainScene: (page: P) => string): P {
  const frames = pictureFrames(page);
  if (!frames) return page;
  const imagePrompt = page.imagePrompt?.trim() ? page.imagePrompt : mainScene(page);
  const extras = (page.extraImagePrompts ?? []).filter((p) => p.trim());
  // A card page's cards picture its first exercise's items, in order.
  const cardItems = page.sourceShape?.pageType === "cards" ? (page.blocks.find(isExerciseBlock)?.items ?? []).slice(extras.length) : [];
  const subjects = [
    ...cardItems,
    ...(page.glossary ?? []).map((g) => g.term),
    ...page.blocks.filter(isExerciseBlock).map((b) => b.heading.replace(/^\d+\s*/, "")),
  ].filter((s) => s && !extras.some((e) => e.includes(s)));
  while (extras.length < frames - 1 && subjects.length) {
    extras.push(`A simple, clear picture of ${subjects.shift()}, on a plain background, for a coursebook page.`);
  }
  return { ...page, imagePrompt, extraImagePrompts: extras.slice(0, Math.max(0, frames - 1)) };
}

// The pictures a page must carry: its zone plan's frames, and on a card or
// panel page one per card / panel (sourceShape.pictures, page-types.ts) -
// a card strip the analyzer measured as one picture still needs a picture
// per card.
export function pictureFrames(page: Pick<ShapedPage, "zonePlan" | "sourceShape">): number {
  const zone = page.zonePlan ? zonePictureCount(page.zonePlan) : 0;
  const type = page.sourceShape?.pageType;
  return zone && (type === "cards" || type === "panels") ? Math.max(zone, page.sourceShape?.pictures ?? 0) : zone;
}
