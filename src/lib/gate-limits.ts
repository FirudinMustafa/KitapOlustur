// Audit 2026-10-18: every approval gate and the rerun route start paid AI
// work, and their request bodies were accepted unbounded (500 units on a
// rerun, 1,000 copies of the same unit in one content-change request, any
// page in an image review). These caps are enforced at the API so the
// workflow never receives more work than a human could reasonably ask for.

export const MAX_UNIT_LIMIT = 30;
// Change rounds after the first content approval / character drawing.
export const MAX_CONTENT_CHANGE_ROUNDS = 5;
export const MAX_CHARACTER_REDRAW_ROUNDS = 5;
export const MAX_COMMENT_LENGTH = 2000;

export function isValidUnitLimit(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_UNIT_LIMIT;
}

// One entry per unit - repeated entries for the same unit are joined into a
// single comment (the workflow rebuilds a unit once per entry). Units the
// gate is not showing are dropped.
export function normalizeContentChanges(
  raw: unknown,
  knownUnits: ReadonlySet<number>,
): { unitNumber: number; comment: string }[] {
  if (!Array.isArray(raw)) return [];
  const byUnit = new Map<number, string[]>();
  for (const c of raw) {
    if (typeof c !== "object" || c === null) continue;
    const { unitNumber, comment } = c as Record<string, unknown>;
    if (typeof unitNumber !== "number" || !knownUnits.has(unitNumber)) continue;
    if (typeof comment !== "string" || !comment.trim()) continue;
    const list = byUnit.get(unitNumber) ?? [];
    list.push(comment.trim());
    byUnit.set(unitNumber, list);
  }
  return [...byUnit].map(([unitNumber, comments]) => ({
    unitNumber,
    comment: comments.join("\n").slice(0, MAX_COMMENT_LENGTH),
  }));
}

type ImageDecision = { unitNumber: number; pageNumber: number; action: "accept" | "regenerate" };

// Only images the gate flagged can be decided on, each once (last one wins).
export function normalizeImageDecisions(
  raw: unknown,
  flagged: readonly { unitNumber: number; pageNumber: number }[],
): ImageDecision[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(flagged.map((f) => `${f.unitNumber}:${f.pageNumber}`));
  const byKey = new Map<string, ImageDecision>();
  for (const d of raw) {
    if (typeof d !== "object" || d === null) continue;
    const { unitNumber, pageNumber, action } = d as Record<string, unknown>;
    if (typeof unitNumber !== "number" || typeof pageNumber !== "number") continue;
    if (action !== "accept" && action !== "regenerate") continue;
    const key = `${unitNumber}:${pageNumber}`;
    if (!allowed.has(key)) continue;
    byKey.set(key, { unitNumber, pageNumber, action });
  }
  return [...byKey.values()];
}
