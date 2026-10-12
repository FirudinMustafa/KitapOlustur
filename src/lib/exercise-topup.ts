import { isExerciseBlock } from "@/lib/design/layouts";

// Live runs 2026-10-13 (free Gemini writer): even with the source page's
// exercise count in the blueprint and two shape-check rewrites, whole-unit
// calls kept writing 1-2 exercises where the source page had 3-5. A small,
// focused call per short page ("add these exercises to this page") is what
// the small model does well - the same approach as the answer-key backfill.

export type TopUpPage = {
  sourcePageNumber: number;
  blocks: (Parameters<typeof isExerciseBlock>[0] & { answerKey?: string[] })[];
  sourceShape?: { exercises: number; pictures: number };
};

// How many exercises a page should get added: up to the source page's
// count, at most 4 per page in one go.
export function exercisesToAdd(page: TopUpPage): number {
  const need = page.sourceShape?.exercises ?? 0;
  if (need < 2) return 0;
  const have = page.blocks.filter(isExerciseBlock).length;
  return Math.max(0, Math.min(4, need - have));
}

export function topUpPrompt(page: TopUpPage & { pageType?: string }, count: number, formats: string[], language: string): string {
  const existing = page.blocks.map((b) => `- ${b.heading}${b.body ? `: ${b.body.slice(0, 160)}` : ""}`).join("\n");
  return [
    `This coursebook page (in ${language}) needs ${count} more short exercise block${count > 1 ? "s" : ""}, on the same topic and vocabulary as its existing content:`,
    existing,
    `Write exactly ${count} new exercise blocks. Each: kind "practice", a short heading (the instruction, no number), 3-6 items, and an answerKey with exactly one correct answer per item, in order. Answers go ONLY in answerKey - never in a table or in the items.`,
    formats.length
      ? `Use different formats from those already on the page, preferably these the source series uses (reproduce the format, never the wording): ${formats.join(" | ")}.`
      : "Use different formats from those already on the page (gap fill, matching, ordering, true/false...).",
    "Keep every block short - the page must still fit on one printed page.",
  ].join("\n\n");
}

// The new exercises go after the page's existing blocks.
export function appendExercises<P extends TopUpPage>(page: P, blocks: P["blocks"]): P {
  const usable = blocks.filter((b) => b.items?.length && b.items.length === (b.answerKey?.length ?? 0));
  return usable.length ? { ...page, blocks: [...page.blocks, ...usable] } : page;
}
