import { isExerciseBlock } from "@/lib/design/layouts";

// Live runs 2026-10-13 (free Gemini writer): even with the source page's
// exercise count in the blueprint and two shape-check rewrites, whole-unit
// calls kept writing 1-2 exercises where the source page had 3-5. A small,
// focused call per short page ("add these exercises to this page") is what
// the small model does well - the same approach as the answer-key backfill.

export type TopUpPage = {
  sourcePageNumber: number;
  blocks: (Parameters<typeof isExerciseBlock>[0] & { answerKey?: string[] })[];
  sourceShape?: { exercises: number; pictures: number; items?: number };
};

// How many exercises a page should get added: up to the source page's
// count, at most 6 per page in one go (Faz G4: was 4 - coursebook pages
// carry 5-7).
export function exercisesToAdd(page: TopUpPage): number {
  const need = page.sourceShape?.exercises ?? 0;
  if (need < 2) return 0;
  const have = page.blocks.filter(isExerciseBlock).length;
  return Math.max(0, Math.min(6, need - have));
}

export function topUpPrompt(page: TopUpPage & { pageType?: string }, count: number, formats: string[], language: string): string {
  const existing = page.blocks.map((b) => `- ${b.heading}${b.body ? `: ${b.body.slice(0, 160)}` : ""}`).join("\n");
  return [
    `This coursebook page (in ${language}) needs ${count} more short exercise block${count > 1 ? "s" : ""}, on the same topic and vocabulary as its existing content:`,
    existing,
    `Write exactly ${count} new exercise blocks. Each: kind "practice", a short heading (the instruction, no number), ${page.sourceShape?.items && page.sourceShape.items >= 3 ? `about ${page.sourceShape.items}` : "3-6"} items, and an answerKey with exactly one correct answer per item, in order. Answers go ONLY in answerKey - never in a table or in the items. Items are the real text the learner reads - never placeholders like "Picture of a ball" or "Item 1".`,
    formats.length
      ? `Use different formats from those already on the page, preferably these the source series uses (reproduce the format, never the wording): ${formats.join(" | ")}.`
      : "Use different formats from those already on the page (gap fill, matching, ordering, true/false...).",
    "Keep every block short - the page must still fit on one printed page.",
  ].join("\n\n");
}

// The new exercises go after the page's existing blocks. Live run
// 2026-10-13: the free model wrote the items but left answerKey out, and
// requiring a complete key dropped every exercise. An exercise with items is
// kept; a missing or mismatched key is removed so fillMissingAnswerKeys
// (the next step) writes one.
export function appendExercises<P extends TopUpPage>(page: P, blocks: P["blocks"]): P {
  const usable = blocks
    .filter((b) => b.items?.length)
    .map((b) => (b.answerKey?.length === b.items!.length ? b : { ...b, answerKey: undefined }));
  return usable.length ? { ...page, blocks: [...page.blocks, ...usable] } : page;
}

// Live comparison 2026-10-14: with the page's exercises in place, the page
// still printed half empty - the writer gave 3 items where the source's
// exercises had about 7. Plain exercises (no puzzle, interactive or diagram
// format, whose items are shaped by that format) are lengthened toward the
// source's items per exercise.
type ExtendableBlock = TopUpPage["blocks"][number] & { activity?: unknown; interactive?: unknown; diagram?: unknown };

export function itemsToAdd(block: ExtendableBlock, target: number | undefined): number {
  if (!target || target < 4 || !block.items?.length) return 0;
  if (block.activity || block.interactive || block.diagram) return 0;
  const have = block.items.length;
  if (have >= Math.ceil(target * 0.75)) return 0;
  return Math.min(8, target - have);
}

export function extendPrompt(blocks: { index: number; block: ExtendableBlock; count: number }[], language: string): string {
  const list = blocks
    .map(({ index, block, count }) => `Exercise ${index}: "${block.heading}"${block.body ? ` (${block.body.slice(0, 160)})` : ""}\nExisting items:\n${block.items!.map((i) => `- ${i}`).join("\n")}\nAdd ${count} items.`)
    .join("\n\n");
  return [
    `These coursebook exercises (in ${language}) are too short. For each, write the requested number of NEW items in exactly the same format and style as its existing items, on the same topic - no repeats, no numbering.`,
    list,
    "Return, for each exercise, its index, the new items and an answerKey with exactly one answer per new item, in order. Answers go ONLY in answerKey.",
  ].join("\n\n");
}

// Appends the new items. The block's answer key is extended when both the
// old key and the new answers line up with their items; otherwise it is
// dropped so fillMissingAnswerKeys writes a complete one.
export function extendExercises<P extends TopUpPage>(page: P, additions: { index: number; items: string[]; answerKey?: string[] }[]): P {
  const blocks = page.blocks.map((block, i) => {
    const add = additions.find((a) => a.index === i);
    const items = add?.items.map((t) => t.trim()).filter(Boolean) ?? [];
    if (!items.length || !block.items?.length) return block;
    const oldKeyOk = block.answerKey?.length === block.items.length;
    const newKeyOk = add!.answerKey?.length === items.length;
    return {
      ...block,
      items: [...block.items, ...items],
      answerKey: oldKeyOk && newKeyOk ? [...block.answerKey!, ...add!.answerKey!.map((t) => t.trim())] : undefined,
    };
  });
  return { ...page, blocks } as P;
}
