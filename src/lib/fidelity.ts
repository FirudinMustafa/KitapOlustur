import type { SourcePageLayout } from "@/lib/source-layout";

// Faz B7: "how close is the generated book to the source's format?" as a
// number, not an impression. Both PDFs are measured with the same analyzer
// (src/lib/source-layout.ts) and compared page by page on what makes a page
// look like its source: how many pictures, how many numbered exercises,
// one or two text columns, and where the main picture sits.
//
// Content is deliberately not compared - it is supposed to differ.

export type PageFidelity = {
  sourcePage: number;
  generatedPage: number | null;
  pictures: [number, number];
  exercises: [number, number];
  columns: [number, number];
  zone: [string, string];
  score: number;
};

export type BookFidelity = { pages: PageFidelity[]; score: number; byAspect: Record<"pictures" | "exercises" | "columns" | "zone", number> };

const closeness = (a: number, b: number) => (a === b ? 1 : 1 - Math.abs(a - b) / Math.max(a, b, 1));

// `pairs` maps source page numbers to generated page numbers (1-based); a
// source page with no generated page scores 0.
export function compareLayouts(source: SourcePageLayout[], generated: SourcePageLayout[], pairs: [number, number | null][]): BookFidelity {
  const pages = pairs.map(([s, g]): PageFidelity => {
    const src = source[s - 1];
    const gen = g ? generated[g - 1] : undefined;
    if (!src || !gen) {
      return {
        sourcePage: s,
        generatedPage: g,
        pictures: [src?.images.length ?? 0, 0],
        exercises: [src?.exerciseCount ?? 0, 0],
        columns: [src?.textColumns ?? 0, 0],
        zone: [src?.zone ?? "", ""],
        score: 0,
      };
    }
    const aspects = {
      pictures: closeness(src.images.length, gen.images.length),
      exercises: closeness(src.exerciseCount, gen.exerciseCount),
      columns: src.textColumns === gen.textColumns ? 1 : 0,
      zone: src.zone === gen.zone ? 1 : 0,
    };
    return {
      sourcePage: s,
      generatedPage: g,
      pictures: [src.images.length, gen.images.length],
      exercises: [src.exerciseCount, gen.exerciseCount],
      columns: [src.textColumns, gen.textColumns],
      zone: [src.zone, gen.zone],
      score: (aspects.pictures + aspects.exercises + aspects.columns + aspects.zone) / 4,
    };
  });
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const matched = pages.filter((p) => p.generatedPage);
  return {
    pages,
    score: mean(pages.map((p) => p.score)),
    byAspect: {
      pictures: mean(matched.map((p) => closeness(p.pictures[0], p.pictures[1]))),
      exercises: mean(matched.map((p) => closeness(p.exercises[0], p.exercises[1]))),
      columns: mean(matched.map((p) => (p.columns[0] === p.columns[1] ? 1 : 0))),
      zone: mean(matched.map((p) => (p.zone[0] === p.zone[1] ? 1 : 0))),
    },
  };
}
