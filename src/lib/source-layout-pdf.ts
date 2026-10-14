import { analyzeStextPage, hasBackgroundImage, rasterPictureBoxes, type SourcePageLayout, type StextBlock } from "@/lib/source-layout";

const RASTER_WIDTH_PX = 600; // enough to see a gutter between comic panels

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
      const sp = { width: x1 - x0, height: y1 - y0, blocks: parsed.blocks };
      // Artwork flattened into a page-sized image is found from a rendering.
      let rasterImages;
      if (hasBackgroundImage(sp)) {
        const scale = RASTER_WIDTH_PX / sp.width;
        const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
        rasterImages = rasterPictureBoxes(
          { width: pix.getWidth(), height: pix.getHeight(), channels: pix.getNumberOfComponents(), data: pix.getPixels() },
          sp,
        );
        pix.destroy();
      }
      out.push(analyzeStextPage({ ...sp, rasterImages }));
      stext.destroy();
      page.destroy();
    }
    return out;
  } finally {
    doc.destroy();
  }
}
