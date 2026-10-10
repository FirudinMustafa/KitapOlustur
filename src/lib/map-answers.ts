import type { GeneratedPage } from "@/lib/ai/schemas";
import type { MapPlace } from "@/lib/diagrams";

// Live E2E 2026-10-10: the writer drew a map and then answered questions
// about it wrongly ("The cinema is ___ the bank." -> "opposite" for two
// places side by side). The map is drawn exactly from its grid, so the true
// relation can be computed: every "The X is ___ the Y (and the Z)." item on
// a page with a map gets an answer that agrees with the drawing.

export type Relation = "next to" | "between" | "opposite" | "to the left of" | "to the right of";

const ITEM = /^\s*the\s+(.+?)\s+is\s+_{2,}\s+the\s+(.+?)(?:\s+and\s+the\s+(.+?))?\s*[.?!]*\s*$/i;

function findPlace(places: MapPlace[], name: string): MapPlace | undefined {
  const key = name.trim().toLowerCase();
  return places.find((p) => p.name.trim().toLowerCase() === key);
}

// Every relation that is true on the grid, most specific first.
export function trueRelations(places: MapPlace[], x: string, y: string, z?: string): Relation[] {
  const a = findPlace(places, x);
  const b = findPlace(places, y);
  if (!a || !b) return [];
  if (z) {
    const c = findPlace(places, z);
    if (!c) return [];
    const sameRow = a.row === b.row && a.row === c.row;
    const sides = [b.col, c.col].sort((m, n) => m - n);
    return sameRow && sides[0] === a.col - 1 && sides[1] === a.col + 1 ? ["between"] : [];
  }
  const out: Relation[] = [];
  if (a.row === b.row) {
    if (Math.abs(a.col - b.col) === 1) out.push("next to");
    out.push(a.col < b.col ? "to the left of" : "to the right of");
  } else if (a.col === b.col) {
    out.push("opposite");
  }
  return out;
}

export type MapAnswerFix = { heading: string; item: string; was: string; now: string };

// Rewrites answers that contradict the page's map; leaves items it can't
// parse, or whose places aren't on the map, as they are.
export function fixMapAnswers(page: GeneratedPage): { page: GeneratedPage; fixes: MapAnswerFix[] } {
  const places = page.blocks.flatMap((b) => (b.diagram?.type === "map" ? (b.diagram.places ?? []) : []));
  if (!places.length) return { page, fixes: [] };
  const fixes: MapAnswerFix[] = [];
  const blocks = page.blocks.map((block) => {
    if (!block.items?.length) return block;
    let changed = false;
    const answerKey = block.items.map((item, i) => {
      const was = block.answerKey?.[i] ?? "";
      const m = ITEM.exec(item);
      if (!m) return was;
      const truth = trueRelations(places, m[1], m[2], m[3]);
      if (!truth.length || truth.includes(was.trim().toLowerCase() as Relation)) return was;
      changed = true;
      fixes.push({ heading: block.heading, item, was, now: truth[0] });
      return truth[0];
    });
    return changed ? { ...block, answerKey } : block;
  });
  return { page: { ...page, blocks }, fixes };
}
