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

export function numberExercises<P extends { blocks: Parameters<typeof isExerciseBlock>[0][] }>(page: P, start = 1): P {
  let n = start - 1;
  return {
    ...page,
    blocks: page.blocks.map((b) => (isExerciseBlock(b) ? { ...b, heading: `${++n} ${stripExerciseNumber(b.heading)}` } : b)),
  };
}

type NumberedPage = Parameters<typeof numberExercises>[0] & { sourcePageNumber: number; sourceShape?: { firstExercise?: number } };

// Hand-made comparison 2026-10-24: a coursebook numbers a lesson's
// exercises across its pages - i5 Team 2's lesson 1a runs 1-3 on p.12 and
// 4-7 on p.13; the generated pages started again at 1 on every page. A page
// whose source page goes on with the lesson (sourceShape.firstExercise,
// measured) goes on with the numbering of the page before it; every other
// page starts at 1 as before.
export function numberUnitExercises<P extends NumberedPage>(pages: P[]): P[] {
  let last = 0;
  let prevSource: number | null = null;
  return pages.map((page) => {
    const continues = !!page.sourceShape?.firstExercise && prevSource !== null && page.sourcePageNumber === prevSource + 1;
    const numbered = numberExercises(page, continues ? last + 1 : 1);
    const count = numbered.blocks.filter((b) => isExerciseBlock(b)).length;
    last = (continues ? last : 0) + count;
    prevSource = page.sourcePageNumber;
    return numbered;
  });
}
