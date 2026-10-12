// Faz "Sayfa Dizilimi Editörü": tek doğruluk kaynağı - hem BookDocument.tsx'in
// react-pdf render'ı hem de LayoutEditor.tsx'in canvas'ı ve BookReader.tsx'in
// önizlemesi bu sabitlerden türetilir, aralarında px/pt kayması olmasın diye.
// Değerler BookDocument.tsx'in önceden var olan sabit `padding: 44,
// paddingBottom: 56` stilinden alındı - davranış değişikliği yok, tek kaynağa
// taşındı.
export const PAGE_WIDTH_PT = 595.28; // A4
export const PAGE_HEIGHT_PT = 841.89;
export const PAGE_PADDING = { top: 44, right: 44, bottom: 56, left: 44 };
export const CONTENT_WIDTH_PT = PAGE_WIDTH_PT - PAGE_PADDING.left - PAGE_PADDING.right;
export const CONTENT_HEIGHT_PT = PAGE_HEIGHT_PT - PAGE_PADDING.top - PAGE_PADDING.bottom;

// Yapılandırılabilir Trim Size (Baskı Boyutu) (2026-09-21, ROADMAP.md): a
// SEPARATE registry from the constants above - only BookDocument.tsx/
// ContentsDocument.tsx (the actual exported PDF) read this, to pick the
// react-pdf <Page size> for a project's chosen trim size. LayoutEditor.tsx
// (Faz 3's free-form editor) and BookReader.tsx's preview deliberately keep
// using the bare A4 constants above, unchanged - their BlockLayout data
// stores ABSOLUTE pt coordinates against an A4 canvas, so wiring a non-A4
// trim size through them would misalign any previously-saved custom block
// position. Documented, bounded limitation (see ROADMAP.md's "kapsam dışı"
// note) rather than a rescale/migration effort.
export type TrimSizeId = "a4" | "6x9" | "7x10" | "220x280";
export const TRIM_SIZES: Record<TrimSizeId, { widthPt: number; heightPt: number; label: string }> = {
  a4: { widthPt: PAGE_WIDTH_PT, heightPt: PAGE_HEIGHT_PT, label: "A4" },
  "6x9": { widthPt: 432, heightPt: 648, label: "6×9 inç (Trade Paperback)" },
  "7x10": { widthPt: 504, heightPt: 720, label: "7×10 inç (Ders Kitabı Boyutu)" },
  // Faz B5: the format most ELT coursebooks are printed in.
  "220x280": { widthPt: 623.62, heightPt: 793.7, label: "220×280 mm (ELT ders kitabı)" },
};

// What a project can choose: a size, or "auto" - the size closest to the
// uploaded source book's (resolved once the source is measured).
export type TrimSizeChoice = TrimSizeId | "auto";
export const TRIM_SIZE_CHOICES: TrimSizeChoice[] = ["auto", "a4", "220x280", "7x10", "6x9"];

export function isTrimSizeChoice(v: unknown): v is TrimSizeChoice {
  return v === "auto" || (typeof v === "string" && v in TRIM_SIZES);
}

// A concrete size for rendering; "auto" not yet resolved prints A4.
export function resolveTrimSize(choice: TrimSizeChoice | null | undefined): TrimSizeId {
  return choice && choice !== "auto" ? choice : "a4";
}

// The supported size closest to a measured page (relative difference of
// width and height); a source far from all of them still gets the nearest.
export function nearestTrimSize(widthPt: number, heightPt: number): TrimSizeId {
  const ids = Object.keys(TRIM_SIZES) as TrimSizeId[];
  const distance = (id: TrimSizeId) =>
    Math.abs(TRIM_SIZES[id].widthPt - widthPt) / widthPt + Math.abs(TRIM_SIZES[id].heightPt - heightPt) / heightPt;
  return ids.reduce((best, id) => (distance(id) < distance(best) ? id : best), ids[0]);
}

// ---- Faz 4 "Baskıya hazır çıktı" ----
// 3 mm bleed on every edge - the standard most print services (Amazon KDP,
// Lulu, offset printers) ask for. A print PDF's pages are trim + 2 × bleed;
// anything meant to run to the edge (covers, hero/full-bleed pictures)
// paints into it and gets trimmed off.
export const BLEED_PT = 8.5; // 3 mm

export const PRINT_DPI = 300;

// Spine thickness per printed page (one leaf = 2 pages) - Amazon KDP's
// published paper factors. Page count is rounded up to an even number.
export const PAPER_THICKNESS_IN: Record<"white" | "cream", number> = { white: 0.002252, cream: 0.0025 };

export function spineWidthPt(pageCount: number, paper: "white" | "cream" = "white"): number {
  const pages = pageCount + (pageCount % 2);
  return pages * PAPER_THICKNESS_IN[paper] * 72;
}

/** Effective print resolution of an image of `px` pixels placed `placedPt` wide. */
export function effectiveDpi(px: number, placedPt: number): number {
  return Math.round(px / (placedPt / 72));
}

/** Pixel width an image needs to print at PRINT_DPI when placed `placedPt` wide. */
export function pixelsForPrint(placedPt: number): number {
  return Math.ceil((placedPt / 72) * PRINT_DPI);
}
