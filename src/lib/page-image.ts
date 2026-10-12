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

// Faz B3: a page's additional pictures (extraImagePrompts) live in the same
// pageImages map under negative keys, so they can never collide with a real
// sourcePageNumber: picture k (1-based) of page n is -(n * 10 + k).
export function extraImageKey(sourcePageNumber: number, k: number): number {
  return -(sourcePageNumber * 10 + k);
}

// Every picture a page shows, main picture first. Extra pictures follow the
// page's own number (they are never moved in Dizilim).
export function resolvePageImageUrls(
  page: Pick<GeneratedPage, "sourcePageNumber" | "imageOverrideSourcePageNumber" | "extraImagePrompts">,
  pageImages: Record<number, string> | null | undefined,
): string[] {
  const main = resolvePageImageUrl(page, pageImages);
  const extras = (page.extraImagePrompts ?? [])
    .map((_, i) => pageImages?.[extraImageKey(page.sourcePageNumber, i + 1)])
    .filter((u): u is string => !!u);
  return main ? [main, ...extras] : extras;
}
