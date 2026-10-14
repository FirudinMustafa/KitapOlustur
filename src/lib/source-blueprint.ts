import type { GeneratedPage, SourcePage } from "@/lib/ai/schemas";
import { buildZonePlan, zonePictureCount } from "@/lib/design/zones";

// Faz B2: what the writer is told about each source page it mirrors. The
// measured shape (pictures, exercises, columns, density, exercise formats)
// comes first and is binding; the model's prose summary supplies the topic.
// The source's verbatim text is left out on purpose - it was only ever an
// invitation to paraphrase too closely.
export function writerBlueprint(pages: SourcePage[]) {
  return pages.map((p) => {
    const plan = p.layout ? buildZonePlan(p.layout) : null;
    return {
      sourcePageNumber: p.pageNumber,
      pageType: p.pageType,
      summary: p.summary,
      imageDescription: p.imageDescription,
      ...(p.layout
        ? {
            measured: {
              pictures: plan ? zonePictureCount(plan) : 0,
              numberedExercises: p.layout.exerciseCount,
              itemsPerExercise: p.layout.exerciseCount ? Math.round(p.layout.itemCount / p.layout.exerciseCount) : undefined,
              textColumns: p.layout.textColumns,
              words: p.layout.wordCount,
              exerciseFormats: p.layout.exerciseRubrics.length ? p.layout.exerciseRubrics : undefined,
            },
          }
        : { layoutZone: p.visualStyle?.layoutZone }),
    };
  });
}

export const BLUEPRINT_INSTRUCTIONS = [
  "Where a source page has \"measured\", match that page's shape - it was measured from the printed page, so it is how the page really looks:",
  "- pictures: give the generated page exactly that many pictures - imagePrompt for the first, extraImagePrompts for the rest (each a simple, separate subject that reads in a small frame, e.g. one vocabulary item each). 0 means no imagePrompt.",
  "- numberedExercises: write the same number of exercise blocks (each with items and a matching answerKey), with about itemsPerExercise items each.",
  "- exerciseFormats: the source's exercise instructions, in order. Reproduce each exercise's FORMAT (circle, match, complete, listen and number, write, ask and answer...) with entirely new content and your own wording - never copy the instruction text.",
  "- words: keep the page's total text within about 25% of this.",
  "- textColumns: 2 means short, parallel blocks rather than one long block.",
].join("\n");

// Deterministic follow-up to the writer: each mirrored page gets its source
// page's zone plan, and its picture prompts are trimmed to the plan's slots
// (a prompt with no frame to print in would be paid for and never shown).
export function applyZonePlans(pages: GeneratedPage[], sourcePages: SourcePage[]): GeneratedPage[] {
  return pages.map((page) => {
    const layout = sourcePages.find((s) => s.pageNumber === page.sourcePageNumber)?.layout;
    if (!layout) return page;
    const plan = buildZonePlan(layout);
    const sourceShape = {
      exercises: layout.exerciseCount,
      pictures: plan ? zonePictureCount(plan) : 0,
      items: layout.exerciseCount ? Math.round(layout.itemCount / layout.exerciseCount) : 0,
    };
    if (!plan) return { ...page, sourceShape };
    const extraSlots = Math.max(0, zonePictureCount(plan) - 1);
    // The source page has no picture - neither does the mirrored page (a
    // prompt here would be paid for and never printed).
    if (!zonePictureCount(plan)) return { ...page, sourceShape, zonePlan: plan, imagePrompt: undefined, extraImagePrompts: undefined };
    return {
      ...page,
      sourceShape,
      zonePlan: plan,
      extraImagePrompts: page.extraImagePrompts?.length ? page.extraImagePrompts.slice(0, extraSlots) : page.extraImagePrompts,
    };
  });
}

// Faz B6: the complementary book (the Workbook when a Student Book was
// uploaded, or the reverse) had no plan beyond "comparable page count", so
// it came out generic. It now gets a shape derived from the measured source
// unit: how many pages, how many exercises and items per page, and the
// exercise formats the series uses - and it follows the unit's pages in
// order, the way a real workbook page practises its student-book lesson.
export function complementaryPlan(sourcePages: SourcePage[], complementaryType: "student_book" | "workbook"): string | null {
  const measured = sourcePages.filter((p) => p.layout);
  if (!measured.length) return null;
  const exercisePages = measured.filter((p) => (p.layout?.exerciseCount ?? 0) > 0);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const exercisesPerPage = Math.round(mean(exercisePages.map((p) => p.layout!.exerciseCount)));
  const items = mean(exercisePages.filter((p) => p.layout!.exerciseCount).map((p) => p.layout!.itemCount / p.layout!.exerciseCount));
  const formats = [...new Set(measured.flatMap((p) => p.layout!.exerciseRubrics))].slice(0, 12);
  const n = sourcePages.length;
  const pages = complementaryType === "workbook" ? Math.max(2, Math.round(n * 0.6)) : Math.max(2, Math.round(n * 1.5));
  const lines =
    complementaryType === "workbook"
      ? [
          `Write ${pages} workbook pages for this unit. Workbook page k practises the reference pages in order (the first workbook page practises the first lesson, and so on) - same vocabulary, same grammar, new sentences.`,
          `Each workbook page carries ${Math.min(6, Math.max(3, exercisesPerPage + 1))} numbered exercises with about ${Math.max(4, Math.round(items) || 5)} items each - a workbook page is denser than a student-book page and mostly exercises, with at most a short instruction or example.`,
          "Vary the exercise formats across the unit using the activity formats (picture_label, word_bank, crossword, wordsearch, unscramble, odd_one_out, tick_cross, ordering, match_lines, write_lines...) - a workbook unit typically has at least one puzzle (crossword or wordsearch) and ends with a short writing task.",
        ]
      : [
          `Write ${pages} student-book pages for this unit, presenting what the reference workbook pages practise, in the same order.`,
          `Each student-book page opens with a presentation (a short reading text, a dialogue, or a grammar table) and then has ${Math.max(2, Math.min(4, exercisesPerPage))} numbered exercises; most pages carry a picture.`,
        ];
  if (formats.length) {
    lines.push(`The source series uses these exercise instructions (reproduce the FORMATS with your own wording, never copy them): ${JSON.stringify(formats)}`);
  }
  return lines.join("\n");
}

// Faz B: a mirrored side must have one page per source page. Live run
// 2026-10-13: a 14-page unit came back as 2 pages - nothing checked the
// count. Long units are written in chunks of MIRROR_CHUNK source pages and
// any page still missing is asked for once more.
export const MIRROR_CHUNK = 6;

export function chunkSourcePages<P>(pages: P[], size = MIRROR_CHUNK): P[][] {
  const out: P[][] = [];
  for (let i = 0; i < pages.length; i += size) out.push(pages.slice(i, i + size));
  return out;
}

export function missingSourcePages(pages: { sourcePageNumber: number }[], sourcePages: { pageNumber: number }[]): number[] {
  const have = new Set(pages.map((p) => p.sourcePageNumber));
  return sourcePages.map((s) => s.pageNumber).filter((n) => !have.has(n));
}

// The generated pages in source order, one per source page (first wins),
// dropping any page the writer numbered outside the unit.
export function orderBySource<T extends { sourcePageNumber: number }>(pages: T[], sourcePages: { pageNumber: number }[]): T[] {
  const byNumber = new Map<number, T>();
  for (const p of pages) if (!byNumber.has(p.sourcePageNumber)) byNumber.set(p.sourcePageNumber, p);
  return sourcePages.flatMap((s) => (byNumber.has(s.pageNumber) ? [byNumber.get(s.pageNumber)!] : []));
}
