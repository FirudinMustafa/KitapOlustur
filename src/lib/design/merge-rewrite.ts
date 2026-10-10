import type { ContentBlock, GeneratedPage } from "@/lib/ai/schemas";
import { isChecklistBlock, isExerciseBlock } from "@/lib/design/layouts";

// Live E2E 2026-10-10: the design loop's page rewrite (rewritePageToFit)
// returned the workbook pages without their activity formats, pictures,
// diagrams and every answer key - the prompt said "keep every exercise and
// its answers", nothing enforced it, and the printed workbook lost its
// picture grid and its whole answer-key page. A rewrite may change wording;
// the exercises themselves are carried over from the reviewed original.

function isExercise(b: ContentBlock): boolean {
  return isExerciseBlock(b) || !!b.activity || !!b.diagram;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function hasFullKey(b: ContentBlock): boolean {
  if (!b.items?.length || isChecklistBlock(b)) return true;
  return b.items.length === (b.answerKey?.length ?? 0);
}

export function mergePageRewrite(original: GeneratedPage, rewritten: GeneratedPage): GeneratedPage {
  const originals = original.blocks.filter(isExercise);
  const used = new Set<ContentBlock>();

  const blocks: ContentBlock[] = [];
  for (const block of rewritten.blocks) {
    const match = originals.find((o) => !used.has(o) && norm(o.heading) === norm(block.heading));
    if (match) {
      used.add(match);
      // the rewrite's words for the instructions; the exercise as reviewed
      blocks.push({ ...match, body: block.body || match.body });
    } else if (isExercise(block)) {
      // an exercise the rewrite added (enrich) - only with a complete key,
      // since the answer-key backfill has already run
      if (hasFullKey(block) && !block.activity && !block.diagram) blocks.push(block);
    } else {
      blocks.push(block);
    }
  }
  // exercises the rewrite dropped or renamed go back where they were
  for (const o of originals) {
    if (used.has(o)) continue;
    const at = original.blocks.indexOf(o);
    blocks.splice(Math.min(at, blocks.length), 0, o);
  }
  return { ...rewritten, layoutTemplate: rewritten.layoutTemplate ?? original.layoutTemplate, blocks };
}
