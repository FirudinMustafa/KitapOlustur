import { analyzeStextPage, type SourcePageLayout, type StextBlock } from "@/lib/source-layout";

// Kept apart from source-layout.ts on purpose: the workflow bundle (CJS)
// cannot contain mupdf (top-level await), and workflow-level code uses the
// pure helpers there (dominantTrim). Only steps import this file.
// Whole-document pass. mupdf is WebAssembly and imported lazily, as in
// src/lib/pdf/rasterize.ts.
export async function analyzeSourceLayout(pdf: Uint8Array): Promise<SourcePageLayout[]> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  try {
    const out: SourcePageLayout[] = [];
    const total = doc.countPages();
    for (let i = 0; i < total; i++) {
      const page = doc.loadPage(i);
      const [x0, y0, x1, y1] = page.getBounds();
      const stext = page.toStructuredText("preserve-images");
      const parsed = JSON.parse(stext.asJSON()) as { blocks: StextBlock[] };
      out.push(analyzeStextPage({ width: x1 - x0, height: y1 - y0, blocks: parsed.blocks }));
      stext.destroy();
      page.destroy();
    }
    return out;
  } finally {
    doc.destroy();
  }
}
