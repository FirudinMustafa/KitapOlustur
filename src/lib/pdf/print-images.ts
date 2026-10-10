import sharp from "sharp";

// Faz 4 "Baskıya hazır çıktı": AI images come out at 1024-1536 px, which is
// roughly 150-220 DPI at the sizes they're placed on a page - below the 300
// DPI printers check for. For the print PDF only, each image is resampled
// (Lanczos) to the pixel size it needs at 300 DPI and re-encoded as a
// high-quality JPEG. This removes preflight rejections and soft-edge
// pixelation; it cannot invent detail, and the print report says so.

export type PrintImage = { src: string; nativeWidth: number; targetWidth: number; upscaled: boolean };

export async function prepareImageForPrint(url: string, targetWidthPx: number): Promise<PrintImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(input).metadata();
    const nativeWidth = meta.width ?? 0;
    if (!nativeWidth) return null;
    const upscaled = nativeWidth < targetWidthPx;
    const pipeline = sharp(input).flatten({ background: "#ffffff" });
    const out = await (upscaled ? pipeline.resize({ width: targetWidthPx, kernel: "lanczos3" }) : pipeline)
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
      .toBuffer();
    return { src: `data:image/jpeg;base64,${out.toString("base64")}`, nativeWidth, targetWidth: Math.max(nativeWidth, targetWidthPx), upscaled };
  } catch {
    return null;
  }
}

// One pass over every distinct image URL of a book (pages often share
// one), keyed back to the original URL.
export async function prepareImagesForPrint(urls: string[], targetWidthPx: number): Promise<Map<string, PrintImage>> {
  const out = new Map<string, PrintImage>();
  for (const url of new Set(urls)) {
    const img = await prepareImageForPrint(url, targetWidthPx);
    if (img) out.set(url, img);
  }
  return out;
}
