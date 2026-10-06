import { getImageDimensions } from "@/lib/image-dimensions";

// Faz "ISBN/baskıya hazırlık": fetched server-side (not client-side) so
// there's no cross-origin fetch from the browser to the Blob host. Shared by
// the project page and GET /api/projects/[id] - the run page's live polling
// replaces its whole data object with the API response, so the API has to
// carry this too or the print-readiness card flips to "Kapak henüz yok" on
// the first refresh (QA fix, 2026-10-06).
export async function fetchCoverDimensions(
  coverImageUrl: string | null | undefined,
): Promise<{ width: number; height: number } | null> {
  if (!coverImageUrl) return null;
  try {
    const res = await fetch(coverImageUrl);
    if (!res.ok) return null;
    return getImageDimensions(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}
