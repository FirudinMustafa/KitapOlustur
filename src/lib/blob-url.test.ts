import { describe, expect, it } from "vitest";
import { isOwnBlobUrl } from "./blob-url";

describe("isOwnBlobUrl", () => {
  it("accepts Vercel Blob URLs", () => {
    expect(isOwnBlobUrl("https://abc123.public.blob.vercel-storage.com/studio/x/image.png")).toBe(true);
  });

  it("rejects other schemes and hosts", () => {
    expect(isOwnBlobUrl("javascript:alert(1)")).toBe(false);
    expect(isOwnBlobUrl("http://abc123.public.blob.vercel-storage.com/x.png")).toBe(false);
    expect(isOwnBlobUrl("https://evil.example.com/x.png")).toBe(false);
    expect(isOwnBlobUrl("https://public.blob.vercel-storage.com.evil.com/x.png")).toBe(false);
    expect(isOwnBlobUrl("not a url")).toBe(false);
  });
});
