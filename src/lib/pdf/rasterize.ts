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

// Page-by-page variant for large books: each page is encoded (JPEG - a
// fraction of a PNG's size for typeset pages with pictures), handed to
// `onPage` and released before the next one is rendered, so memory stays
// flat however long the book is. Live E2E 2026-10-09: rendering every page
// of two books into memory at once got the dev server reaped for low memory.
export async function forEachRasterizedPage(
  pdf: Uint8Array,
  onPage: (page: { pageNumber: number; jpeg: Uint8Array }) => Promise<void>,
  { dpi = 100, quality = 85 }: { dpi?: number; quality?: number } = {},
): Promise<number> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  try {
    const scale = dpi / 72;
    const total = doc.countPages();
    for (let i = 0; i < total; i++) {
      const page = doc.loadPage(i);
      const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
      const jpeg = pix.asJPEG(quality);
      pix.destroy();
      page.destroy();
      await onPage({ pageNumber: i + 1, jpeg });
    }
    return total;
  } finally {
    doc.destroy();
  }
}

// Faz G3: how far down each page's content reaches (pt from the sheet's
// top), ignoring anything that starts below `footerFrom` (the running
// footer). Measured from the PDF's own text and image boxes - vector
// drawings (table rules, card fills) are not among them, so callers keep a
// margin for the padding below the last line.
export async function pageContentBottoms(pdf: Uint8Array, pages: number[], footerFrom: number): Promise<Map<number, number>> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  try {
    const out = new Map<number, number>();
    for (const n of pages) {
      if (n < 1 || n > doc.countPages()) continue;
      const page = doc.loadPage(n - 1);
      const stext = page.toStructuredText("preserve-images");
      const { blocks } = JSON.parse(stext.asJSON()) as { blocks: { bbox: { y: number; h: number } }[] };
      let bottom = 0;
      for (const b of blocks) if (b.bbox.y < footerFrom) bottom = Math.max(bottom, b.bbox.y + b.bbox.h);
      out.set(n, bottom);
      stext.destroy();
      page.destroy();
    }
    return out;
  } finally {
    doc.destroy();
  }
}
