import type { GeneratedUnit, UnitOutline } from "./ai/schemas";
import type { PageArrayField } from "./layout-merge";

// "Dizilim" (2026-09-21, ROADMAP.md): the pure, testable core of the
// unit/page reordering editor - same "pure function + a route that does the
// I/O" split as src/lib/layout-merge.ts. Reuses PageArrayField from that
// file rather than redefining it.

// Faz 4d's synthetic mid-term/final units use 90001/90002 - any unitNumber
// at or above this threshold is treated as synthetic (no outline.units
// entry exists for it) and is never touched by renumbering.
const SYNTHETIC_UNIT_NUMBER_THRESHOLD = 90000;

export function isSyntheticUnit(unit: GeneratedUnit): boolean {
  return unit.unitNumber >= SYNTHETIC_UNIT_NUMBER_THRESHOLD;
}

export function reorderUnits(units: GeneratedUnit[], fromIndex: number, toIndex: number): GeneratedUnit[] {
  if (fromIndex < 0 || fromIndex >= units.length || toIndex < 0 || toIndex >= units.length) {
    throw new Error(`Geçersiz ünite indeksi: ${fromIndex} -> ${toIndex}`);
  }
  const next = units.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

// Moves (or reorders within the same unit) a single page. When
// fromUnitNumber !== toUnitNumber, the moved page's own `unitNumber` field
// is updated to the destination unit's number - purely informational
// metadata (pagesForVariant/rendering key off array membership, not this
// field), but kept consistent rather than left stale.
export function movePage(
  units: GeneratedUnit[],
  fromUnitNumber: number,
  pageArrayField: PageArrayField,
  fromIndex: number,
  toUnitNumber: number,
  toIndex: number,
): GeneratedUnit[] {
  const fromUnitIndex = units.findIndex((u) => u.unitNumber === fromUnitNumber);
  if (fromUnitIndex === -1) throw new Error(`Ünite ${fromUnitNumber} bulunamadı.`);
  const toUnitIndex = units.findIndex((u) => u.unitNumber === toUnitNumber);
  if (toUnitIndex === -1) throw new Error(`Ünite ${toUnitNumber} bulunamadı.`);

  const sourcePages = units[fromUnitIndex][pageArrayField] ?? [];
  if (fromIndex < 0 || fromIndex >= sourcePages.length) {
    throw new Error(`Ünite ${fromUnitNumber} için ${pageArrayField}[${fromIndex}] sayfası bulunamadı.`);
  }
  const page = sourcePages[fromIndex];

  if (fromUnitIndex === toUnitIndex) {
    const reordered = sourcePages.slice();
    reordered.splice(fromIndex, 1);
    const clampedTo = Math.max(0, Math.min(toIndex, reordered.length));
    reordered.splice(clampedTo, 0, page);
    return units.map((u, i) => (i === fromUnitIndex ? { ...u, [pageArrayField]: reordered } : u));
  }

  const remainingSource = sourcePages.slice();
  remainingSource.splice(fromIndex, 1);

  const destPages = (units[toUnitIndex][pageArrayField] ?? []).slice();
  const movedPage = { ...page, unitNumber: toUnitNumber };
  const clampedTo = Math.max(0, Math.min(toIndex, destPages.length));
  destPages.splice(clampedTo, 0, movedPage);

  return units.map((u, i) => {
    if (i === fromUnitIndex) return { ...u, [pageArrayField]: remainingSource };
    if (i === toUnitIndex) return { ...u, [pageArrayField]: destPages };
    return u;
  });
}

export interface RenumberResult {
  units: GeneratedUnit[];
  outlineUnits: UnitOutline[];
}

// Renumbers only the "real" units (those with a matching outline.units
// entry) to 1..N following the units array's CURRENT order - synthetic
// units (see isSyntheticUnit) keep their sentinel unitNumber untouched.
// outlineUnits is updated in lockstep so outline.units[i].number always
// matches its unit's new unitNumber - this is what keeps
// reviewBookCoherence/buildContentsUnits's `outline.units.find(ou =>
// ou.number === u.unitNumber)` lookups correct after a reorder (see
// ROADMAP.md's "Dizilim" note for why this dual-write is necessary).
export function renumberRealUnits(units: GeneratedUnit[], outlineUnits: UnitOutline[]): RenumberResult {
  const outlineByNumber = new Map(outlineUnits.map((ou) => [ou.number, ou]));
  let nextNumber = 1;
  const newOutlineUnits: UnitOutline[] = [];

  const newUnits = units.map((unit) => {
    if (isSyntheticUnit(unit)) return unit;
    const outlineUnit = outlineByNumber.get(unit.unitNumber);
    if (!outlineUnit) return unit; // no matching outline entry - leave as-is, not our concern to invent one

    const assignedNumber = nextNumber++;
    newOutlineUnits.push({ ...outlineUnit, number: assignedNumber });

    if (assignedNumber === unit.unitNumber) return unit;
    const renumberedPages = (pages: typeof unit.studentBookPages) =>
      pages.map((p) => (p.unitNumber === unit.unitNumber ? { ...p, unitNumber: assignedNumber } : p));
    return {
      ...unit,
      unitNumber: assignedNumber,
      studentBookPages: renumberedPages(unit.studentBookPages),
      workbookPages: renumberedPages(unit.workbookPages),
      teacherBookPages: unit.teacherBookPages ? renumberedPages(unit.teacherBookPages) : unit.teacherBookPages,
      testBookletPages: unit.testBookletPages ? renumberedPages(unit.testBookletPages) : unit.testBookletPages,
    };
  });

  return { units: newUnits, outlineUnits: newOutlineUnits };
}
