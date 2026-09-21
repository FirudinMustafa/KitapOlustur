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
export type TrimSizeId = "a4" | "6x9" | "7x10";
export const TRIM_SIZES: Record<TrimSizeId, { widthPt: number; heightPt: number; label: string }> = {
  a4: { widthPt: PAGE_WIDTH_PT, heightPt: PAGE_HEIGHT_PT, label: "A4" },
  "6x9": { widthPt: 432, heightPt: 648, label: "6×9 inç (Trade Paperback)" },
  "7x10": { widthPt: 504, heightPt: 720, label: "7×10 inç (Ders Kitabı Boyutu)" },
};
