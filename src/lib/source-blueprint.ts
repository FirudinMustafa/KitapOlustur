import type { GeneratedPage, SourcePage } from "@/lib/ai/schemas";
import type { SourcePageLayout } from "@/lib/source-layout";
import { wordBudget } from "@/lib/source-shape";
import { buildZonePlan, zonePictureCount } from "@/lib/design/zones";
import { classifyPageType, typedPictureCount } from "@/lib/design/page-types";
import { hasLessonFurniture, lessonShape, type LessonShape } from "@/lib/lesson-furniture";

// Faz B2: what the writer is told about each source page it mirrors. The
// measured shape (pictures, exercises, columns, density, exercise formats)
// comes first and is binding; the model's prose summary supplies the topic.
// The source's verbatim text is left out on purpose - it was only ever an
// invitation to paraphrase too closely.
// Below this many measured words a page's text is taken as not extractable
// (a scan, or text outlined to shapes) - no word budget is set for it.
const MIN_MEASURED_WORDS = 8;

// The word count a page's budget is set from, or undefined where none is.
export function measuredWords(layout: Pick<SourcePageLayout, "wordCount">): number | undefined {
  return layout.wordCount >= MIN_MEASURED_WORDS ? layout.wordCount : undefined;
}

// youngLearners: KIYAS-14 (2026-10-23) - told "words: 11" and the rule for
// working out the limit, the writer still wrote 2-4 times the source's words
// on Pre-A1 pages. Each page now also carries its limit as a number.
export function writerBlueprint(pages: SourcePage[], options: { youngLearners?: boolean } = {}) {
  // Lesson furniture only where these pages show the book has lessons
  // (codes or section heads on two pages) - a young learners' page title is
  // not a lesson tab.
  const lessons = hasLessonFurniture(pages.map((p) => p.layout));
  return pages.map((p) => {
    const plan = p.layout ? buildZonePlan(p.layout) : null;
    const design = p.layout ? classifyPageType(p.layout) : "mixed";
    const words = p.layout ? measuredWords(p.layout) : undefined;
    return {
      sourcePageNumber: p.pageNumber,
      pageType: p.pageType,
      summary: p.summary,
      imageDescription: p.imageDescription,
      ...(p.layout
        ? {
            measured: {
              // "Önce sayfa tasarımı": a picture page's design (page-types.ts).
              ...(design !== "mixed" ? { design } : {}),
              pictures: typedPictureCount(design, p.layout, plan ? zonePictureCount(plan) : 0),
              numberedExercises: p.layout.exerciseCount,
              itemsPerExercise: p.layout.exerciseCount ? Math.round(p.layout.itemCount / p.layout.exerciseCount) : undefined,
              textColumns: p.layout.textColumns,
              words,
              wordLimit: options.youngLearners && words !== undefined ? `at most ${wordBudget(words)} words on this page` : undefined,
              exerciseFormats: p.layout.exerciseRubrics.length ? p.layout.exerciseRubrics : undefined,
              listeningExercises: p.layout.listeningCount || undefined,
              ...(lessons && p.layout.lessonHead ? { lesson: p.layout.lessonHead.coded ? "opens (coded)" : "opens (titled)" } : {}),
              ...(lessons && p.layout.sectionHeads?.length ? { sections: p.layout.sectionHeads } : {}),
              ...(lessons && p.layout.wordBox ? { wordBox: true } : {}),
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
  "- itemsPerExercise 0: the source's exercises have no written items - learners point at, colour, stick or count things in the pictures. Keep each item to the single word or number the picture shows (e.g. \"chair\", \"3\", \"blue\"), never a sentence describing a picture; a list of numbers or colour words prints as coloured cards.",
  "- exerciseFormats: the source's exercise instructions, in order. Reproduce each exercise's FORMAT (circle, match, complete, listen and number, write, ask and answer...) with entirely new content and your own wording - never copy the instruction text. An exercise's heading IS its instruction, as a coursebook prints it (e.g. \"Read again and circle a or b.\", \"Listen and repeat. Which of these do you do?\") - never a title or label in front of it (not \"Geography Quiz\", \"Peer-Interview\", \"Quick-Check: Family Members\"). A second instruction sentence may go in body.",
  "- listeningExercises: that many of the page's exercises are done with a recording (listen and point / number / tick, listen and sing / chant, watch and listen to the story). Write each as a listening exercise and add a listeningAudio entry for every one: blockRef = that exercise block's exact heading, script = exactly what the recording says (the words or sentences to point at in item order, the full song or chant lyrics, the story's dialogue with dialogueLines per speaker).",
  "- words: the printed page's whole text (headings, instructions, items, speech). A hard limit: at most 1.5 times this (or this + 20, whichever is more) - a page over it is sent back. For young learners' pages the pictures carry the exercise: one short instruction, items of a word or two.",
  "- wordLimit: that page's word limit, worked out for you - count the page's words (headings, instructions, items, speech, word banks, callout boxes except \"tip\") and stay under it. Leave out explanations and extra boxes; a teacher's note goes in a \"tip\" callout, which the pupil's book doesn't print.",
  "- textColumns: 2 means short, parallel blocks rather than one long block.",
  "- lesson: the page opens a new lesson - set lessonTitle (the lesson's own short title, 1-4 words) and, for \"opens (coded)\", lessonCode (unit number + letter in order through the unit: \"1a\", \"1b\"...). They print on the lesson's tab; do not repeat them as a block.",
  "- sections: the section heads the source prints on this page, in order (Reading, Vocabulary, Grammar...). Group the page's exercises the same way and set each exercise's \"section\" to its group's name; the heads are printed for you - never write them as blocks or into headings.",
  "- wordBox: set lessonWords to the lesson's 6-10 key words and phrases (the new vocabulary its texts and exercises use); they print in a \"Check these words\" box beside the lesson tab.",
  "- design: the page is built from its pictures, not from text. Follow it exactly - it overrides \"pictures\" above where they differ:",
  "  - \"scene\": one full-page picture. imagePrompt is the whole scene (a place full of things and people to talk about). The first exercise's items are 4-8 single words naming things clearly visible in that scene (they are printed as labels on the picture), e.g. \"window\", \"door\", \"chair\" - every word must be something drawn in the imagePrompt. Keep any other text to one short line.",
  "  - \"cards\": a grid of numbered picture cards. The first exercise has one item per card - a single word or number each (e.g. \"red\", \"3\", \"pencil\"). extraImagePrompts: one simple object per card in the same order as the items (one object, centred, plain white background, no text), as many as there are cards (at most 10). imagePrompt is the page's other picture (the scene of a later exercise), or a picture of the cards' topic.",
  "  - \"panels\": a numbered story-panel grid. One picture per panel in story order - imagePrompt is panel 1, extraImagePrompts panels 2, 3... (the same characters and place in every panel). The story exercise has one item per panel: that panel's short speech line (a few words, e.g. \"Hello, I'm Leo!\").",
].join("\n");

// The source page's first exercise number when it goes on with the lesson
// of the page before (numbered above 1) - sourceShape.firstExercise.
export function continuesLesson(layout: Pick<SourcePageLayout, "firstExerciseNumber">): { firstExercise?: number } {
  return layout.firstExerciseNumber && layout.firstExerciseNumber > 1 ? { firstExercise: layout.firstExerciseNumber } : {};
}

// The source page's lesson furniture (lesson tab, section heads, word box,
// pointers - src/lib/lesson-furniture.ts), as sourceShape.lesson.
export function lessonOf(layout: Pick<SourcePageLayout, "lessonHead" | "sectionHeads" | "wordBox" | "pointers">): { lesson?: LessonShape } {
  const lesson = lessonShape(layout);
  return lesson ? { lesson } : {};
}

// Deterministic follow-up to the writer: each mirrored page gets its source
// page's zone plan, and its picture prompts are trimmed to the plan's slots
// (a prompt with no frame to print in would be paid for and never shown).
export function applyZonePlans(pages: GeneratedPage[], sourcePages: SourcePage[]): GeneratedPage[] {
  return pages.map((page) => {
    const layout = sourcePages.find((s) => s.pageNumber === page.sourcePageNumber)?.layout;
    if (!layout) return page;
    const plan = buildZonePlan(layout);
    const pageType = classifyPageType(layout);
    // A card or panel page carries a picture per card / panel, more than
    // its zone plan may have frames for (typedPictureCount).
    const pictures = typedPictureCount(pageType, layout, plan ? zonePictureCount(plan) : 0);
    const sourceShape = {
      exercises: layout.exerciseCount,
      pictures,
      items: layout.exerciseCount ? Math.round(layout.itemCount / layout.exerciseCount) : 0,
      // A hard budget only where the page has a real text layer: a scanned
      // page (or one with outlined text) measures ~0 words, and a budget of
      // 20 would send every unit back to be rewritten and crush its text.
      ...(measuredWords(layout) !== undefined ? { words: layout.wordCount } : {}),
      pageType,
      ...continuesLesson(layout),
      ...lessonOf(layout),
    };
    if (!plan) return { ...page, sourceShape };
    const extraSlots = Math.max(0, pictures - 1);
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

// Source words one answer can mirror. KIYAS-15: six i5 pages (~1,900 words
// with their blueprint) ran a 32k-token answer out; Super Minds' six pages
// (~130 words) fit easily. A page of unknown size counts as dense.
export const MIRROR_CHUNK_WORDS = 900;

export function chunkSourcePagesByWords<P extends { layout?: { wordCount: number } | null }>(pages: P[], maxWords = MIRROR_CHUNK_WORDS, maxPages = MIRROR_CHUNK): P[][] {
  const out: P[][] = [];
  let cur: P[] = [];
  let words = 0;
  for (const p of pages) {
    const w = p.layout?.wordCount ?? maxWords / 2;
    if (cur.length && (cur.length >= maxPages || words + w > maxWords)) {
      out.push(cur);
      cur = [];
      words = 0;
    }
    cur.push(p);
    words += w;
  }
  if (cur.length) out.push(cur);
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
