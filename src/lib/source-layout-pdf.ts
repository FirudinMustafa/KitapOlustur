import {
  analyzeStextPage,
  designColors,
  furnitureKeys,
  hasBackgroundImage,
  rasterPictureBoxes,
  stripFurniture,
  type SourcePageLayout,
  type StextBlock,
} from "@/lib/source-layout";

const RASTER_WIDTH_PX = 600; // enough to see a gutter between comic panels
const COLOUR_WIDTH_PX = 120; // design colours need no detail (Faz G1)

// Kept apart from source-layout.ts on purpose: the workflow bundle (CJS)
// cannot contain mupdf (top-level await), and workflow-level code uses the
// pure helpers there (dominantTrim). Only steps import this file.
// Whole-document pass. mupdf is WebAssembly and imported lazily, as in
// src/lib/pdf/rasterize.ts.
export async function analyzeSourceLayout(pdf: Uint8Array): Promise<SourcePageLayout[]> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  try {
    // First pass: every page's text, so running heads and watermark lines
    // repeated across the book can be told from content (furnitureKeys).
    const total = doc.countPages();
    const parsedPages: { width: number; height: number; blocks: StextBlock[] }[] = [];
    for (let i = 0; i < total; i++) {
      const page = doc.loadPage(i);
      const [x0, y0, x1, y1] = page.getBounds();
      const stext = page.toStructuredText("preserve-images");
      const parsed = JSON.parse(stext.asJSON()) as { blocks: StextBlock[] };
      parsedPages.push({ width: x1 - x0, height: y1 - y0, blocks: parsed.blocks });
      stext.destroy();
      page.destroy();
    }
    const furniture = furnitureKeys(parsedPages);

    const out: SourcePageLayout[] = [];
    for (let i = 0; i < total; i++) {
      const page = doc.loadPage(i);
      const sp = parsedPages[i];
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
      const layout = analyzeStextPage({ ...stripFurniture(sp, furniture), rasterImages });
      const colourScale = COLOUR_WIDTH_PX / sp.width;
      const small = page.toPixmap(mupdf.Matrix.scale(colourScale, colourScale), mupdf.ColorSpace.DeviceRGB, false, true);
      layout.designColors = designColors(
        { width: small.getWidth(), height: small.getHeight(), channels: small.getNumberOfComponents(), data: small.getPixels() },
        layout.images,
      );
      small.destroy();
      out.push(layout);
      page.destroy();
    }
    return out;
  } finally {
    doc.destroy();
  }
}
