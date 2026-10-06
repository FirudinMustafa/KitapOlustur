import { getImageDimensions } from "@/lib/image-dimensions";

// Faz "ISBN/baskıya hazırlık": fetched server-side (not client-side) so
// there's no cross-origin fetch from the browser to the Blob host. Shared by
// the project page and GET /api/projects/[id] - the run page's live polling
// replaces its whole data object with the API response, so the API has to
// carry this too or the print-readiness card flips to "Kapak henüz yok" on
// the first refresh (QA fix, 2026-10-06).
// Blob URLs are content-addressed in practice (a new cover gets a new URL
// or a new run), so results are memoized per URL - the run page polls this
// endpoint every few seconds and must not re-download the cover each time.
const cache = new Map<string, { width: number; height: number } | null>();

export async function fetchCoverDimensions(
  coverImageUrl: string | null | undefined,
): Promise<{ width: number; height: number } | null> {
  if (!coverImageUrl) return null;
  if (cache.has(coverImageUrl)) return cache.get(coverImageUrl)!;
  try {
    const res = await fetch(coverImageUrl);
    if (!res.ok) return null;
    const dims = getImageDimensions(Buffer.from(await res.arrayBuffer()));
    if (cache.size > 500) cache.clear();
    cache.set(coverImageUrl, dims);
    return dims;
  } catch {
    return null;
  }
}
