// Page-range helpers over a source PDF (mupdf, imported lazily as in
// rasterize.ts). Used to analyze long books in chunks: one model call over a
// whole 150-page coursebook ran into the output-token cap and silently
// dropped the tail of the page map.

// A new PDF holding pages from..to (1-based, inclusive) of `pdf`.
export async function slicePdf(pdf: Uint8Array, from: number, to: number): Promise<Uint8Array> {
  const mupdf = await import("mupdf");
  const src = new mupdf.PDFDocument(pdf);
  const out = new mupdf.PDFDocument();
  try {
    for (let i = from - 1; i < to; i++) out.graftPage(-1, src, i);
    const buf = out.saveToBuffer("compress");
    const bytes = buf.asUint8Array().slice();
    buf.destroy();
    return bytes;
  } finally {
    out.destroy();
    src.destroy();
  }
}

// The text layer of pages from..to, verbatim, one string per page. Empty
// strings mean the page has no text layer (a scan).
export async function pdfPageTexts(pdf: Uint8Array, from: number, to: number): Promise<string[]> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  try {
    const out: string[] = [];
    for (let i = from - 1; i < Math.min(to, doc.countPages()); i++) {
      const page = doc.loadPage(i);
      const stext = page.toStructuredText("preserve-whitespace");
      out.push(stext.asText().replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim());
      stext.destroy();
      page.destroy();
    }
    return out;
  } finally {
    doc.destroy();
  }
}
