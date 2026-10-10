import type { ContentBlock, GeneratedPage, GeneratedUnit } from "@/lib/ai/schemas";
import { isChecklistBlock } from "@/lib/design/layouts";

// A workbook whose exercises print without answers is unusable for the
// teacher - and the writer model sometimes still leaves answerKey short
// after every structural retry. These helpers find exactly those blocks so
// a small, focused model call can answer just them (see
// fillMissingAnswerKeys in workflows/book-pipeline.tsx), instead of
// regenerating the whole unit a third time.

const PAGE_FIELDS = ["studentBookPages", "workbookPages", "teacherBookPages", "testBookletPages"] as const;
type PageField = (typeof PAGE_FIELDS)[number];

export type AnswerKeyGap = {
  id: string;
  heading: string;
  body: string;
  items: string[];
};

function needsKey(block: ContentBlock): boolean {
  return !!block.items?.length && !isChecklistBlock(block) && block.items.length !== (block.answerKey?.length ?? 0);
}

function gapId(field: PageField, pageIndex: number, blockIndex: number) {
  return `${field}:${pageIndex}:${blockIndex}`;
}

export function findAnswerKeyGaps(unit: GeneratedUnit): AnswerKeyGap[] {
  const gaps: AnswerKeyGap[] = [];
  for (const field of PAGE_FIELDS) {
    (unit[field] ?? []).forEach((page: GeneratedPage, p) =>
      page.blocks.forEach((block, b) => {
        if (needsKey(block)) gaps.push({ id: gapId(field, p, b), heading: block.heading, body: block.body, items: block.items! });
      }),
    );
  }
  return gaps;
}

// Only an answer list with exactly one entry per item is applied - a
// mismatched list would print answers against the wrong questions.
export function applyAnswerKeys(unit: GeneratedUnit, answers: { id: string; answerKey: string[] }[]): GeneratedUnit {
  const byId = new Map(answers.map((a) => [a.id, a.answerKey]));
  const next: GeneratedUnit = { ...unit };
  for (const field of PAGE_FIELDS) {
    const pages = unit[field];
    if (!pages) continue;
    (next as Record<PageField, GeneratedPage[] | undefined>)[field] = pages.map((page, p) => ({
      ...page,
      blocks: page.blocks.map((block, b) => {
        const key = byId.get(gapId(field, p, b));
        return key && needsKey(block) && key.length === block.items!.length ? { ...block, answerKey: key } : block;
      }),
    }));
  }
  return next;
}
