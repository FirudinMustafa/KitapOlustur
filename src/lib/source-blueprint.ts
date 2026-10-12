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
    const plan = layout ? buildZonePlan(layout) : null;
    if (!plan) return page;
    const extraSlots = Math.max(0, zonePictureCount(plan) - 1);
    return {
      ...page,
      zonePlan: plan,
      extraImagePrompts: page.extraImagePrompts?.length ? page.extraImagePrompts.slice(0, extraSlots) : page.extraImagePrompts,
    };
  });
}
