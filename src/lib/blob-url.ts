// QA fix (2026-10-06): user-supplied image URLs (reference images) were
// stored as-is - "javascript:..." or any third-party host was accepted, and
// those URLs are later handed to the model provider as image inputs, i.e. a
// way to make the server side fetch arbitrary addresses. Only this app's own
// Vercel Blob store (what the upload flow produces) is accepted.
export function isOwnBlobUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com");
}
