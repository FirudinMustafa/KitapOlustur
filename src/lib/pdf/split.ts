import { furnitureKey, furnitureKeys, type StextBlock } from "@/lib/source-layout";

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

// The text layer of pages from..to, one string per page, without the lines
// repeated in the top/bottom band of most pages of the whole document - a
// running head or a publisher's watermark is not source content (see
// furnitureKeys). Empty strings mean the page has no text layer (a scan).
export async function pdfPageTexts(pdf: Uint8Array, from: number, to: number): Promise<string[]> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  try {
    const pages: { height: number; blocks: StextBlock[] }[] = [];
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i);
      const [, y0, , y1] = page.getBounds();
      const stext = page.toStructuredText("preserve-whitespace");
      pages.push({ height: y1 - y0, blocks: (JSON.parse(stext.asJSON()) as { blocks: StextBlock[] }).blocks });
      stext.destroy();
      page.destroy();
    }
    const furniture = furnitureKeys(pages);

    const out: string[] = [];
    for (let i = from - 1; i < Math.min(to, doc.countPages()); i++) {
      const page = doc.loadPage(i);
      const stext = page.toStructuredText("preserve-whitespace");
      const text = stext
        .asText()
        .split("\n")
        .filter((line) => !furniture.has(furnitureKey(line)))
        .join("\n");
      out.push(text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim());
      stext.destroy();
      page.destroy();
    }
    return out;
  } finally {
    doc.destroy();
  }
}
