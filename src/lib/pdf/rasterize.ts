// Turns a rendered PDF into page images so the finished layout can be
// looked at - by the vision-model page review (Faz 3) and by fixture tests.
// mupdf is WebAssembly (no native binaries), so it runs the same locally,
// in vitest and in a Vercel Function. Imported lazily: it's an ESM module
// with top-level await and only the review step needs it.

export type RasterizedPage = { pageNumber: number; png: Uint8Array; width: number; height: number };

export async function rasterizePdf(
  pdf: Uint8Array,
  { dpi = 110, pages }: { dpi?: number; pages?: number[] } = {},
): Promise<RasterizedPage[]> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  try {
    const scale = dpi / 72;
    const total = doc.countPages();
    const wanted = pages ?? Array.from({ length: total }, (_, i) => i + 1);
    const out: RasterizedPage[] = [];
    for (const n of wanted) {
      if (n < 1 || n > total) continue;
      const page = doc.loadPage(n - 1);
      const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
      out.push({ pageNumber: n, png: pix.asPNG(), width: pix.getWidth(), height: pix.getHeight() });
      pix.destroy();
      page.destroy();
    }
    return out;
  } finally {
    doc.destroy();
  }
}

export async function countPdfPages(pdf: Uint8Array): Promise<number> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  try {
    return doc.countPages();
  } finally {
    doc.destroy();
  }
}
