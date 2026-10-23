import type { GeneratedPage, GeneratedUnit } from "@/lib/ai/schemas";
import { isYoungLearnerLevel } from "@/lib/cefr-vocabulary";
import { isExerciseBlock } from "@/lib/design/layouts";
import { blockPrints, pageWordBudget, pageWordCount, type WordCountOptions } from "@/lib/source-shape";
import { resolveTextStyle } from "@/lib/text-style";

// KIYAS-14 (2026-10-23): the writer still left Student Book pages over their
// word budget after the rewrite loop, and the steps after it (topUpExercises,
// fillMissing*, the design review's "enrich" rewrite) add text nobody counts
// again. Pictures shrank to make room (picture area 29% of the source's).
// A deterministic last pass: a mirrored page still over its budget loses the
// text a learner can do without, in this order, until it fits -
//   1. instruction text that repeats the exercise heading,
//   2. side boxes (tip / did-you-know / remember) after the page's first box,
//   3. instructions cut to their first sentence,
//   4. an exercise's extra instruction where its heading already is one.
// Exercise items, answer keys, dialogue, tables, word banks and listening
// scripts are never touched, and neither are reading texts or grammar boxes.
// A page it can't bring within budget keeps what is left of it.

type Block = GeneratedPage["blocks"][number];

const SIDE_BOXES = new Set(["tip", "did_you_know", "remember"]);
// An instruction short enough to be a rubric, not a reading text.
const MAX_RUBRIC_WORDS = 25;
const EXAMPLE = /^\s*(example|e\.g\.|for example)\b/i;

const norm = (text: string) =>
  text
    .toLowerCase()
    .replace(/^\s*\d+[.)]?\s*/, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const wordsOf = (text: string) => text.split(/\s+/).filter(Boolean).length;

// A body that is an exercise's instruction line(s) rather than text to read:
// short, one paragraph, no gaps to fill, not an artefact (a message, a note).
function isRubric(block: Block): boolean {
  const body = block.body.trim();
  return !!body && isExerciseBlock(block) && !block.callout && !resolveTextStyle(block) && wordsOf(body) <= MAX_RUBRIC_WORDS && !/\n/.test(body) && !/_{2,}/.test(body);
}

export function firstSentence(text: string): string {
  const match = text.trim().match(/^[\s\S]*?[.!?](?=\s|$)/);
  return match ? match[0].trim() : text.trim();
}

// The heading carries an instruction of its own ("1 Listen and point"), not
// just a number or a one-word label.
function headingIsInstruction(heading: string): boolean {
  return wordsOf(norm(heading)) >= 2;
}

export type TrimOptions = WordCountOptions & {
  /** Headings of blocks a listening script belongs to - never dropped. */
  protectedHeadings?: Set<string>;
};

export function trimPageToBudget<P extends GeneratedPage>(page: P, options: TrimOptions = {}): P {
  const budget = pageWordBudget(page);
  if (budget === null || pageWordCount(page, options) <= budget) return page;
  const blocks: (Block | null)[] = [...page.blocks];
  const over = () => pageWordCount({ blocks: blocks.filter((b): b is Block => !!b) }, options) > budget;
  const edit = (i: number, change: Partial<Block>) => {
    blocks[i] = { ...blocks[i]!, ...change };
  };

  // 1. An instruction that only repeats the heading.
  for (const [i, b] of blocks.entries()) {
    if (!over()) break;
    if (b && isRubric(b) && norm(b.heading).includes(norm(b.body))) edit(i, { body: "" });
  }

  // 2. Side boxes after the first one that prints, last first. Only plain
  //    boxes: one with items, a table or a listening script stays.
  const printedBoxes = blocks.flatMap((b, i) => (b?.callout && blockPrints(b, options) ? [i] : []));
  for (const i of printedBoxes.slice(1).reverse()) {
    if (!over()) break;
    const b = blocks[i]!;
    const plain = !b.items?.length && !b.table && !b.dialogue?.length && !b.activity && !b.diagram;
    if (SIDE_BOXES.has(b.callout!) && plain && !options.protectedHeadings?.has(norm(b.heading))) blocks[i] = null;
  }

  // 3. Instructions cut to their first sentence. (Not a box's text: "Hello!
  //    I'm Misty." cut to "Hello!" is no longer the language it models.)
  for (const [i, b] of blocks.entries()) {
    if (!over()) break;
    if (!b || !isRubric(b)) continue;
    const first = firstSentence(b.body);
    if (first !== b.body.trim()) edit(i, { body: first });
  }

  // 4. An exercise's extra instruction under a heading that is one (a
  //    worked example stays).
  for (const [i, b] of blocks.entries()) {
    if (!over()) break;
    if (b && isRubric(b) && headingIsInstruction(b.heading) && !EXAMPLE.test(b.body)) edit(i, { body: "" });
  }

  const kept = blocks.filter((b): b is Block => !!b);
  const changed = kept.length !== page.blocks.length || kept.some((b, i) => b !== page.blocks[i]);
  return changed ? { ...page, blocks: kept } : page;
}

// How a unit's pages are counted and trimmed: tips don't count where the
// book hides them (young learners' pupil books, not the teacher's book).
export function unitTrimOptions(unit: Pick<GeneratedUnit, "listeningAudio">, level: string, pupilBook = true): TrimOptions {
  return {
    hideTips: pupilBook && isYoungLearnerLevel(level),
    protectedHeadings: new Set((unit.listeningAudio ?? []).map((a) => norm(a.blockRef))),
  };
}

// The unit's Student Book and Workbook pages trimmed to their budgets.
export function trimUnitToBudget(unit: GeneratedUnit, level: string): GeneratedUnit {
  const options = unitTrimOptions(unit, level);
  const trim = (pages: GeneratedPage[]) => {
    const out = pages.map((p) => trimPageToBudget(p, options));
    return out.some((p, i) => p !== pages[i]) ? out : pages;
  };
  const studentBookPages = trim(unit.studentBookPages);
  const workbookPages = trim(unit.workbookPages ?? []);
  if (studentBookPages === unit.studentBookPages && workbookPages === (unit.workbookPages ?? [])) return unit;
  return { ...unit, studentBookPages, workbookPages };
}
