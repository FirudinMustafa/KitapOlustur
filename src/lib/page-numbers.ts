// Book-wide-unique sourcePageNumber for the pages the writer model numbers
// itself. Pictures are stored and looked up by sourcePageNumber
// (pageImages[n]), so a Workbook page the model happened to number like a
// Student Book page showed - or blocked - that page's picture.
//
// Ranges (per unit, unitNumber * 1000 + offset), chosen to stay clear of:
// - mirrored pages: the real source page numbers (well below 1000), or
//   unitNumber * 1000 + i for skeleton/scratch units (i < ~30);
// - review pages 800000+, mid-term/final 900000+ / 950000+.
const SIDE_OFFSET = { complementary: 300, teacher: 500, test: 700 } as const;

export type NumberedSide = keyof typeof SIDE_OFFSET;

export function renumberSidePages<T extends { sourcePageNumber: number }>(
  pages: T[],
  unitNumber: number,
  side: NumberedSide,
): T[] {
  return pages.map((page, i) => ({ ...page, sourcePageNumber: unitNumber * 1000 + SIDE_OFFSET[side] + i }));
}
