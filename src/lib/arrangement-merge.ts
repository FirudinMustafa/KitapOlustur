import type { BlockLayout, ContentBlock, GeneratedUnit, UnitOutline } from "./ai/schemas";
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

export interface BlockLocation {
  unitNumber: number;
  pageArrayField: PageArrayField;
  pageIndex: number;
  blockIndex: number;
}

export interface MoveBlockResult {
  units: GeneratedUnit[];
  // True when the moved block had a matching listeningAudio entry (matched
  // by ListeningAudio.blockRef === block.heading, see schemas.ts) that had
  // to be migrated to the destination unit along with it - the caller can
  // use this to tell the user their listening audio moved too, since it
  // isn't visually obvious the way a page/block move is.
  audioMoved: boolean;
}

// Moves (or reorders within the same page) a single content block - the
// block-level sibling of movePage above. Unlike movePage, `to.blockIndex` is
// optional (append-at-end when omitted - e.g. a drop straight onto a page
// card rather than onto a specific block slot). A moved block's absolute
// `.layout` (if any) is dropped by default so it doesn't overlap unrelated
// content already positioned on the destination page and falls back to
// normal flow instead; pass layoutOverride to place it precisely (e.g. a
// drop coordinate on the destination canvas).
export function moveBlock(
  units: GeneratedUnit[],
  from: BlockLocation,
  to: { unitNumber: number; pageArrayField: PageArrayField; pageIndex: number; blockIndex?: number },
  layoutOverride?: BlockLayout,
): MoveBlockResult {
  const fromUnitIndex = units.findIndex((u) => u.unitNumber === from.unitNumber);
  if (fromUnitIndex === -1) throw new Error(`Ünite ${from.unitNumber} bulunamadı.`);
  const toUnitIndex = units.findIndex((u) => u.unitNumber === to.unitNumber);
  if (toUnitIndex === -1) throw new Error(`Ünite ${to.unitNumber} bulunamadı.`);

  const fromPages = units[fromUnitIndex][from.pageArrayField] ?? [];
  if (from.pageIndex < 0 || from.pageIndex >= fromPages.length) {
    throw new Error(`Ünite ${from.unitNumber} için ${from.pageArrayField}[${from.pageIndex}] sayfası bulunamadı.`);
  }
  const fromBlocks = fromPages[from.pageIndex].blocks;
  if (from.blockIndex < 0 || from.blockIndex >= fromBlocks.length) {
    throw new Error(`Sayfada blok ${from.blockIndex} bulunamadı.`);
  }
  const block = fromBlocks[from.blockIndex];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure-omit is the idiom for "drop this key"
  const { layout: _droppedLayout, ...blockWithoutLayout } = block;
  const movedBlock: ContentBlock = layoutOverride ? { ...blockWithoutLayout, layout: layoutOverride } : blockWithoutLayout;

  const samePage =
    from.unitNumber === to.unitNumber && from.pageArrayField === to.pageArrayField && from.pageIndex === to.pageIndex;

  if (samePage) {
    const blocks = fromBlocks.slice();
    blocks.splice(from.blockIndex, 1);
    const clampedIndex = Math.max(0, Math.min(to.blockIndex ?? blocks.length, blocks.length));
    blocks.splice(clampedIndex, 0, movedBlock);
    const updatedPages = fromPages.map((p, i) => (i === from.pageIndex ? { ...p, blocks } : p));
    const newUnits = units.map((u, i) => (i === fromUnitIndex ? { ...u, [from.pageArrayField]: updatedPages } : u));
    return { units: newUnits, audioMoved: false };
  }

  if (fromUnitIndex === toUnitIndex) {
    const pages = fromPages.slice();
    if (to.pageIndex < 0 || to.pageIndex >= pages.length) {
      throw new Error(`Ünite ${to.unitNumber} için ${to.pageArrayField}[${to.pageIndex}] sayfası bulunamadı.`);
    }
    const sourceBlocks = pages[from.pageIndex].blocks.slice();
    sourceBlocks.splice(from.blockIndex, 1);
    pages[from.pageIndex] = { ...pages[from.pageIndex], blocks: sourceBlocks };

    const destBlocks = pages[to.pageIndex].blocks.slice();
    const clampedIndex = Math.max(0, Math.min(to.blockIndex ?? destBlocks.length, destBlocks.length));
    destBlocks.splice(clampedIndex, 0, movedBlock);
    pages[to.pageIndex] = { ...pages[to.pageIndex], blocks: destBlocks };

    const newUnits = units.map((u, i) => (i === fromUnitIndex ? { ...u, [from.pageArrayField]: pages } : u));
    return { units: newUnits, audioMoved: false };
  }

  // Farklı ünite - taşınan bloğun heading'ine bağlı bir listeningAudio
  // girdisi varsa (ünite bazlı, bkz. schemas.ts'teki ListeningAudio.blockRef
  // dokümantasyonu) kaynak üniteden hedef üniteye birlikte taşınır, aksi
  // halde ses sessizce koparılmış (orphan) olurdu.
  const destPagesBefore = units[toUnitIndex][to.pageArrayField] ?? [];
  if (to.pageIndex < 0 || to.pageIndex >= destPagesBefore.length) {
    throw new Error(`Ünite ${to.unitNumber} için ${to.pageArrayField}[${to.pageIndex}] sayfası bulunamadı.`);
  }

  const remainingSourceBlocks = fromBlocks.slice();
  remainingSourceBlocks.splice(from.blockIndex, 1);
  const updatedSourcePages = fromPages.map((p, i) => (i === from.pageIndex ? { ...p, blocks: remainingSourceBlocks } : p));

  const destBlocks = destPagesBefore[to.pageIndex].blocks.slice();
  const clampedIndex = Math.max(0, Math.min(to.blockIndex ?? destBlocks.length, destBlocks.length));
  destBlocks.splice(clampedIndex, 0, movedBlock);
  const updatedDestPages = destPagesBefore.map((p, i) => (i === to.pageIndex ? { ...p, blocks: destBlocks } : p));

  const sourceUnit = units[fromUnitIndex];
  const audioEntry = sourceUnit.listeningAudio?.find((a) => a.blockRef === block.heading);
  const audioMoved = !!audioEntry;

  const newUnits = units.map((u, i) => {
    if (i === fromUnitIndex) {
      return {
        ...u,
        [from.pageArrayField]: updatedSourcePages,
        listeningAudio: audioEntry ? u.listeningAudio!.filter((a) => a !== audioEntry) : u.listeningAudio,
      };
    }
    if (i === toUnitIndex) {
      return {
        ...u,
        [to.pageArrayField]: updatedDestPages,
        listeningAudio: audioEntry ? [...(u.listeningAudio ?? []), audioEntry] : u.listeningAudio,
      };
    }
    return u;
  });

  return { units: newUnits, audioMoved };
}

export interface PageLocation {
  unitNumber: number;
  pageArrayField: PageArrayField;
  pageIndex: number;
}

// "Dizilim → Gerçek Kitap" (2026-09-23): moves a page's illustration to a
// DIFFERENT page (possibly a different unit) - the image-level sibling of
// moveBlock. Unlike a block, an image isn't stored as its own array element;
// it's a lookup (see src/lib/page-image.ts's resolvePageImageUrl) keyed by
// sourcePageNumber into the run-wide `pageImages` map. So "moving" it means:
// point the destination page's imageOverrideSourcePageNumber at whichever
// sourcePageNumber the source page was ACTUALLY displaying (its own override
// if it had one, else its own sourcePageNumber), then clear the source page's
// override to `null` (explicitly "no image here now", even though
// pageImages still has an entry under its own sourcePageNumber).
export function moveImage(units: GeneratedUnit[], from: PageLocation, to: PageLocation): GeneratedUnit[] {
  const fromUnitIndex = units.findIndex((u) => u.unitNumber === from.unitNumber);
  if (fromUnitIndex === -1) throw new Error(`Ünite ${from.unitNumber} bulunamadı.`);
  const toUnitIndex = units.findIndex((u) => u.unitNumber === to.unitNumber);
  if (toUnitIndex === -1) throw new Error(`Ünite ${to.unitNumber} bulunamadı.`);

  const fromPages = units[fromUnitIndex][from.pageArrayField] ?? [];
  if (from.pageIndex < 0 || from.pageIndex >= fromPages.length) {
    throw new Error(`Ünite ${from.unitNumber} için ${from.pageArrayField}[${from.pageIndex}] sayfası bulunamadı.`);
  }
  const sourcePage = fromPages[from.pageIndex];
  if (sourcePage.imageOverrideSourcePageNumber === null) {
    throw new Error("Bu sayfada taşınacak bir görsel yok.");
  }
  const imageKey = sourcePage.imageOverrideSourcePageNumber ?? sourcePage.sourcePageNumber;

  const samePage =
    from.unitNumber === to.unitNumber && from.pageArrayField === to.pageArrayField && from.pageIndex === to.pageIndex;
  if (samePage) return units;

  if (fromUnitIndex === toUnitIndex && from.pageArrayField === to.pageArrayField) {
    const pages = fromPages.slice();
    if (to.pageIndex < 0 || to.pageIndex >= pages.length) {
      throw new Error(`Ünite ${to.unitNumber} için ${to.pageArrayField}[${to.pageIndex}] sayfası bulunamadı.`);
    }
    pages[from.pageIndex] = { ...pages[from.pageIndex], imageOverrideSourcePageNumber: null };
    pages[to.pageIndex] = { ...pages[to.pageIndex], imageOverrideSourcePageNumber: imageKey };
    return units.map((u, i) => (i === fromUnitIndex ? { ...u, [from.pageArrayField]: pages } : u));
  }

  const destPagesBefore = units[toUnitIndex][to.pageArrayField] ?? [];
  if (to.pageIndex < 0 || to.pageIndex >= destPagesBefore.length) {
    throw new Error(`Ünite ${to.unitNumber} için ${to.pageArrayField}[${to.pageIndex}] sayfası bulunamadı.`);
  }
  const updatedSourcePages = fromPages.map((p, i) =>
    i === from.pageIndex ? { ...p, imageOverrideSourcePageNumber: null } : p,
  );
  const updatedDestPages = destPagesBefore.map((p, i) =>
    i === to.pageIndex ? { ...p, imageOverrideSourcePageNumber: imageKey } : p,
  );

  return units.map((u, i) => {
    if (i === fromUnitIndex && i === toUnitIndex) {
      // Same unit, different pageArrayField (e.g. studentBookPages -> workbookPages).
      return { ...u, [from.pageArrayField]: updatedSourcePages, [to.pageArrayField]: updatedDestPages };
    }
    if (i === fromUnitIndex) return { ...u, [from.pageArrayField]: updatedSourcePages };
    if (i === toUnitIndex) return { ...u, [to.pageArrayField]: updatedDestPages };
    return u;
  });
}

// "Dizilim → Gerçek Kitap" (2026-09-23): moves a ListeningAudio entry from
// one unit to another - the audio-level sibling of moveBlock/moveImage.
// Audio has no page of its own (it's unit-scoped, matched to a block by
// heading via blockRef - see ListeningAudio in schemas.ts), so unlike
// moveImage/moveBlock this only ever has a destination UNIT, not a page.
export function moveAudio(units: GeneratedUnit[], fromUnitNumber: number, audioIndex: number, toUnitNumber: number): GeneratedUnit[] {
  const fromUnitIndex = units.findIndex((u) => u.unitNumber === fromUnitNumber);
  if (fromUnitIndex === -1) throw new Error(`Ünite ${fromUnitNumber} bulunamadı.`);
  const toUnitIndex = units.findIndex((u) => u.unitNumber === toUnitNumber);
  if (toUnitIndex === -1) throw new Error(`Ünite ${toUnitNumber} bulunamadı.`);
  if (fromUnitIndex === toUnitIndex) return units;

  const sourceAudio = units[fromUnitIndex].listeningAudio ?? [];
  if (audioIndex < 0 || audioIndex >= sourceAudio.length) {
    throw new Error(`Ünite ${fromUnitNumber} için ses ${audioIndex} bulunamadı.`);
  }
  const entry = sourceAudio[audioIndex];

  return units.map((u, i) => {
    if (i === fromUnitIndex) {
      return { ...u, listeningAudio: sourceAudio.filter((_, idx) => idx !== audioIndex) };
    }
    if (i === toUnitIndex) {
      return { ...u, listeningAudio: [...(u.listeningAudio ?? []), entry] };
    }
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
