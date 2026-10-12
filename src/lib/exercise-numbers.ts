import { isExerciseBlock } from "@/lib/design/layouts";

// Faz B5: a printed coursebook numbers the exercises on a page 1, 2, 3...
// The writer numbers them inconsistently (or not at all), so the numbers are
// set here: each exercise heading gets its position on the page, replacing
// whatever number the writer put in front of it. Headings are what the
// answer key prints, so key and page stay in step.
const LEADING_NUMBER = /^\s*(?:(?:Ex(?:ercise)?\.?\s*)?\d{1,2}\s*[.):-]?|[A-Za-z]\))\s+/;

export function stripExerciseNumber(heading: string): string {
  return heading.replace(LEADING_NUMBER, "").trim() || heading.trim();
}

export function numberExercises<P extends { blocks: Parameters<typeof isExerciseBlock>[0][] }>(page: P): P {
  let n = 0;
  return {
    ...page,
    blocks: page.blocks.map((b) => (isExerciseBlock(b) ? { ...b, heading: `${++n} ${stripExerciseNumber(b.heading)}` } : b)),
  };
}
