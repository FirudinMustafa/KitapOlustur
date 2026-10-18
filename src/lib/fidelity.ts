import type { SourcePageLayout } from "@/lib/source-layout";
import { compareLooks, type LookAspect, type PageLook } from "@/lib/page-look";

// Faz B7: "how close is the generated book to the source's format?" as a
// number, not an impression. Both PDFs are measured with the same analyzer
// (src/lib/source-layout.ts) and compared page by page.
//
// Faz G5 (audit 2026-10-18): two separate scores.
// - structure: how many pictures, numbered exercises and items, how many
//   words, one or two text columns, where the main picture sits;
// - look (when page looks are given, src/lib/page-look.ts): colours, how
//   colourful, how much of the page is printed and where, the area the
//   pictures cover, body type size relative to the page.
// An aspect neither page has (0 pictures vs 0 pictures) is "not applicable"
// and left out of the mean - it used to count as a perfect match, so a
// sparse text page scored 100%.
//
// Content is deliberately not compared - it is supposed to differ.

export type StructureAspect = "pictures" | "exercises" | "items" | "words" | "columns" | "zone";
export type FidelityAspect = StructureAspect | LookAspect | "typeSize";

export type PageFidelity = {
  sourcePage: number;
  generatedPage: number | null;
  pictures: [number, number];
  exercises: [number, number];
  items: [number, number];
  words: [number, number];
  columns: [number, number];
  zone: [string, string];
  structure: Partial<Record<StructureAspect, number>>;
  look: Partial<Record<LookAspect | "typeSize", number>> | null;
  structureScore: number;
  lookScore: number | null;
};

export type BookFidelity = {
  pages: PageFidelity[];
  structureScore: number;
  lookScore: number | null;
  byAspect: Partial<Record<FidelityAspect, number>>;
};

const closeness = (a: number, b: number) => (a === b ? 1 : 1 - Math.abs(a - b) / Math.max(a, b, 1));
// Counts both pages lack are not applicable.
const countCloseness = (a: number, b: number) => (a === 0 && b === 0 ? null : closeness(a, b));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const defined = <K extends string>(r: Record<K, number | null>) =>
  Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null)) as Partial<Record<K, number>>;

// `pairs` maps source page numbers to generated page numbers (1-based); a
// source page with no generated page scores 0 on both.
export function compareLayouts(
  source: SourcePageLayout[],
  generated: SourcePageLayout[],
  pairs: [number, number | null][],
  looks?: { source: PageLook[]; generated: PageLook[] },
): BookFidelity {
  const pages = pairs.map(([s, g]): PageFidelity => {
    const src = source[s - 1];
    const gen = g ? generated[g - 1] : undefined;
    const pair = <T,>(f: (l: SourcePageLayout) => T, empty: T): [T, T] => [src ? f(src) : empty, gen ? f(gen) : empty];
    const base = {
      sourcePage: s,
      generatedPage: g,
      pictures: pair((l) => l.images.length, 0),
      exercises: pair((l) => l.exerciseCount, 0),
      items: pair((l) => l.itemCount, 0),
      words: pair((l) => l.wordCount, 0),
      columns: pair((l) => l.textColumns as number, 0),
      zone: pair((l) => l.zone as string, ""),
    };
    if (!src || !gen) {
      return { ...base, structure: {}, look: looks ? {} : null, structureScore: 0, lookScore: looks ? 0 : null };
    }
    const structure = defined<StructureAspect>({
      pictures: countCloseness(src.images.length, gen.images.length),
      exercises: countCloseness(src.exerciseCount, gen.exerciseCount),
      items: countCloseness(src.itemCount, gen.itemCount),
      words: countCloseness(src.wordCount, gen.wordCount),
      columns: src.textColumns === gen.textColumns ? 1 : 0,
      zone: src.zone === gen.zone ? 1 : 0,
    });
    let look: PageFidelity["look"] = null;
    const srcLook = looks?.source[s - 1];
    const genLook = g ? looks?.generated[g - 1] : undefined;
    if (looks && srcLook && genLook) {
      look = defined<LookAspect | "typeSize">({
        ...compareLooks(srcLook, genLook, [src.images, gen.images]),
        // Body text size as a share of the page height, so trim sizes compare.
        typeSize:
          src.bodyFontPt && gen.bodyFontPt
            ? closeness(src.bodyFontPt / src.heightPt, gen.bodyFontPt / gen.heightPt)
            : null,
      });
    } else if (looks) {
      look = {};
    }
    return {
      ...base,
      structure,
      look,
      structureScore: mean(Object.values(structure)),
      lookScore: look ? mean(Object.values(look)) : null,
    };
  });

  // Per aspect, the mean over the matched pages where it applies.
  const values = new Map<FidelityAspect, number[]>();
  for (const p of pages) {
    for (const [k, v] of Object.entries({ ...p.structure, ...(p.look ?? {}) }) as [FidelityAspect, number][]) {
      values.set(k, [...(values.get(k) ?? []), v]);
    }
  }

  return {
    pages,
    structureScore: mean(pages.map((p) => p.structureScore)),
    lookScore: looks ? mean(pages.map((p) => p.lookScore ?? 0)) : null,
    byAspect: Object.fromEntries([...values].map(([k, vs]) => [k, mean(vs)])),
  };
}
