import type { GeneratedPage } from "./ai/schemas";

// "Dizilim → Gerçek Kitap" (2026-09-23): the ONE place that resolves which
// pageImages entry a page actually displays - every renderer (BookDocument.tsx
// for PDF, BookEpub.ts, BookDocx.ts, BookReader.tsx, ArrangementEditor.tsx)
// calls this instead of indexing `pageImages[page.sourcePageNumber]` directly,
// so a moveImage (arrangement-merge.ts) is honored everywhere a page's image
// is ever shown - not just in the editor's own preview.
export function resolvePageImageUrl(
  page: Pick<GeneratedPage, "sourcePageNumber" | "imageOverrideSourcePageNumber">,
  pageImages: Record<number, string> | null | undefined,
): string | undefined {
  if (page.imageOverrideSourcePageNumber === null) return undefined;
  const key = page.imageOverrideSourcePageNumber ?? page.sourcePageNumber;
  return pageImages?.[key];
}
