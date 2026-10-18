// QA fix (2026-10-06): user-supplied image URLs (reference images) were
// stored as-is - "javascript:..." or any third-party host was accepted, and
// those URLs are later handed to the model provider as image inputs, i.e. a
// way to make the server side fetch arbitrary addresses. Only this app's own
// Vercel Blob store (what the upload flow produces) is accepted.
//
// Audit 2026-10-18: any "*.public.blob.vercel-storage.com" host used to pass,
// i.e. a file in someone else's Blob store. When the store's read-write token
// is configured, the host must be this store's. The store id is the 4th "_"
// part of the token - the same parse @vercel/blob does
// (parseStoreIdFromReadWriteToken).
export function isOwnBlobUrl(value: string, token = process.env.BLOB_READ_WRITE_TOKEN): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const storeId = token?.split("_")[3];
  if (storeId) return url.hostname === `${storeId.toLowerCase()}.public.blob.vercel-storage.com`;
  return url.hostname.endsWith(".public.blob.vercel-storage.com");
}
