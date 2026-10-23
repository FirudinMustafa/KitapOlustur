import { z } from "zod";
import type { GeneratedPage, GeneratedUnit } from "./schemas";

// Plan step 4 (2026-10-23): a "scene" page prints its vocabulary words on
// the picture itself, each with a short arrow to its object (source Super
// Minds p.7: "window", "door", "chair"). The writer names the words (the
// page's short items); after the picture is made a cheap vision model finds
// where each one is (locateLabels in workflows/book-pipeline.tsx).

export type PageLabel = NonNullable<GeneratedPage["labels"]>[number];

export const MAX_LABELS = 8;

// The page's design type ("scene" | "cards" | "panels" | "mixed", from the
// measured source page). Read loosely so this works whether it is stored on
// the page or in its sourceShape; the writer's own pageType ("content",
// "exercise", ...) never takes these values.
export function layoutPageType(page: object): string | undefined {
  const p = page as { pageType?: string; sourceShape?: { pageType?: string } };
  return p.sourceShape?.pageType ?? p.pageType;
}

// The words to place: the page's short items (at most three words each),
// without numbering or end punctuation, each once.
export function labelWords(page: Pick<GeneratedPage, "blocks">): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const item of page.blocks.flatMap((b) => b.items ?? [])) {
    const word = item
      .replace(/^\s*(\(?\d+[.)]?|[a-h][.)])\s+/i, "")
      .replace(/[.!?,;:]+$/, "")
      .trim();
    if (!word || word.split(/\s+/).length > 3 || /[_]{2,}|\?/.test(word)) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
    if (words.length === MAX_LABELS) break;
  }
  return words;
}

// What the vision model answers. Boxes in Gemini's native form: [ymin, xmin,
// ymax, xmax] on a 0-1000 scale (no numeric limits in the schema - Gemini
// rejects those, see storedPageSchema's note).
export const labelLocationSchema = z.object({
  labels: z.array(
    z.object({
      word: z.string(),
      found: z.boolean().describe("true only if the object is clearly visible in the picture"),
      box: z.array(z.number()).describe("[ymin, xmin, ymax, xmax] of the object, each 0-1000 (0,0 = top-left); empty when not found"),
    }),
  ),
});

export function labelLocationPrompt(words: string[]): string {
  return [
    "This is an illustration from a children's English coursebook. Labels with these words will be printed on it, each with a short arrow pointing at its object:",
    words.map((w) => `- ${w}`).join("\n"),
    "For each word, find the one object in the picture it names. Return its bounding box as [ymin, xmin, ymax, xmax] on a 0-1000 scale of the picture (0,0 = top-left corner). If the object is not clearly visible, set found=false and leave box empty - never guess. Return every word, in the same order.",
  ].join("\n\n");
}

// The model's boxes -> label points (box centre, fractions of the picture)
// for the requested words that were found; anything malformed is dropped,
// so those words stay as chips under the picture.
export function labelsFromBoxes(words: string[], located: z.infer<typeof labelLocationSchema>): PageLabel[] {
  const labels: PageLabel[] = [];
  for (const word of words) {
    const hit = located.labels.find((l) => l.word.trim().toLowerCase() === word.toLowerCase());
    if (!hit?.found || hit.box.length !== 4 || !hit.box.every(Number.isFinite)) continue;
    const [ymin, xmin, ymax, xmax] = hit.box;
    if (ymax <= ymin || xmax <= xmin) continue;
    // A box covering most of the picture is no position at all.
    if ((ymax - ymin) * (xmax - xmin) > 0.6 * 1000 * 1000) continue;
    const clamp = (v: number) => Math.min(1, Math.max(0, v / 1000));
    labels.push({ word, x: clamp((xmin + xmax) / 2), y: clamp((ymin + ymax) / 2) });
  }
  return labels;
}

// Stores located labels (keyed by sourcePageNumber) on the unit's scene
// pages. Returns the unit unchanged when nothing applies.
export function withPageLabels(unit: GeneratedUnit, labels: Record<number, PageLabel[]>): GeneratedUnit {
  let changed = false;
  const apply = (pages: GeneratedPage[] | undefined) =>
    pages?.map((page) => {
      const found = labels[page.sourcePageNumber];
      if (!found?.length || layoutPageType(page) !== "scene") return page;
      changed = true;
      return { ...page, labels: found };
    });
  const next: GeneratedUnit = {
    ...unit,
    studentBookPages: apply(unit.studentBookPages) ?? [],
    workbookPages: apply(unit.workbookPages) ?? [],
    ...(unit.teacherBookPages ? { teacherBookPages: apply(unit.teacherBookPages) } : {}),
    ...(unit.testBookletPages ? { testBookletPages: apply(unit.testBookletPages) } : {}),
  };
  return changed ? next : unit;
}
