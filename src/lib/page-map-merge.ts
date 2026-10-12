import type { PageMap, SourcePage } from "@/lib/ai/schemas";
import type { SourcePageLayout } from "@/lib/source-layout";

// Joins the model's page descriptions with mupdf's measurements: exactly one
// entry per real page, in order, each carrying its measured layout. The
// measured layout zone replaces the model's guess. A page the model skipped
// gets a stub (inside a unit when both neighbours agree on it) instead of
// silently vanishing from the book.
export function mergePageMap(pageCount: number, described: PageMap["pages"], layouts: SourcePageLayout[]): SourcePage[] {
  const byNumber = new Map<number, SourcePage>();
  for (const p of described) if (!byNumber.has(p.pageNumber)) byNumber.set(p.pageNumber, p);

  const pages: SourcePage[] = [];
  for (let n = 1; n <= pageCount; n++) {
    const layout = layouts[n - 1];
    const page = byNumber.get(n) ?? stubPage(n, byNumber, layout);
    pages.push(
      layout
        ? {
            ...page,
            hasImage: page.hasImage || layout.images.length > 0,
            visualStyle: { hasBrandMark: false, ...page.visualStyle, layoutZone: layout.zone },
            layout,
          }
        : page,
    );
  }
  return pages;
}

function stubPage(n: number, byNumber: Map<number, SourcePage>, layout: SourcePageLayout | undefined): SourcePage {
  const before = [...byNumber.values()].filter((p) => p.pageNumber < n).sort((a, b) => b.pageNumber - a.pageNumber)[0];
  const after = [...byNumber.values()].filter((p) => p.pageNumber > n).sort((a, b) => a.pageNumber - b.pageNumber)[0];
  const unitNumber = before && after && before.unitNumber === after.unitNumber ? before.unitNumber : null;
  return {
    pageNumber: n,
    pageType: unitNumber !== null && (layout?.exerciseCount ?? 0) > 0 ? "exercise" : unitNumber !== null ? "content" : "other",
    unitNumber,
    summary: "Page not described by the analysis model - structure taken from the measured layout only.",
    hasImage: (layout?.images.length ?? 0) > 0,
  };
}
