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
