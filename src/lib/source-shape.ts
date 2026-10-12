import { isExerciseBlock } from "@/lib/design/layouts";
import { zonePictureCount, type ZonePlan } from "@/lib/design/zones";

// Live test 2026-10-12 (free Gemini writer): told "this source page has 5
// numbered exercises and 2 pictures", it wrote 1-2 exercises and no picture
// prompts - so the page lost both the source's density and its layout.
// The measured shape is now checked like the answer keys are: a page far
// below its source's exercise count, or without prompts for the pictures
// its layout has frames for, is sent back to the writer; pictures still
// missing after that are filled in from the page's own content.

export type SourceShape = { exercises: number; pictures: number };

type ShapedPage = {
  sourcePageNumber: number;
  blocks: Parameters<typeof isExerciseBlock>[0][];
  imagePrompt?: string;
  extraImagePrompts?: string[];
  zonePlan?: ZonePlan | null;
  sourceShape?: SourceShape;
  glossary?: { term: string }[];
};

// At least this share of the source's numbered exercises must be there.
const MIN_EXERCISE_SHARE = 0.6;

export function shapeIssues(page: ShapedPage, label: string): string[] {
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
  const frames = page.zonePlan ? zonePictureCount(page.zonePlan) : 0;
  const prompts = (page.imagePrompt ? 1 : 0) + (page.extraImagePrompts?.filter((p) => p.trim()).length ?? 0);
  if (frames > 0 && prompts < frames) {
    issues.push(
      `${label}, page ${page.sourcePageNumber}: the source page has ${frames} pictures; set imagePrompt (the main scene) and ${frames - 1} extraImagePrompts (simple single subjects from this page, e.g. its vocabulary).`,
    );
  }
  return issues;
}

// Deterministic backstop: picture prompts for every frame of the page's
// layout. The main scene comes from the page text; extra frames picture the
// page's own vocabulary (glossary terms, then exercise headings).
export function fillZonePictures<P extends ShapedPage>(page: P, mainScene: (page: P) => string): P {
  const frames = page.zonePlan ? zonePictureCount(page.zonePlan) : 0;
  if (!frames) return page;
  const imagePrompt = page.imagePrompt?.trim() ? page.imagePrompt : mainScene(page);
  const extras = (page.extraImagePrompts ?? []).filter((p) => p.trim());
  const subjects = [
    ...(page.glossary ?? []).map((g) => g.term),
    ...page.blocks.filter(isExerciseBlock).map((b) => b.heading.replace(/^\d+\s*/, "")),
  ].filter((s) => s && !extras.some((e) => e.includes(s)));
  while (extras.length < frames - 1 && subjects.length) {
    extras.push(`A simple, clear picture of ${subjects.shift()}, on a plain background, for a coursebook page.`);
  }
  return { ...page, imagePrompt, extraImagePrompts: extras.slice(0, Math.max(0, frames - 1)) };
}
