import { measurePageLook, type PageLook } from "@/lib/page-look";

const LOOK_WIDTH_PX = 150; // colours and the rough ink map need no detail

// Kept apart from page-look.ts for the same reason as source-layout-pdf.ts:
// mupdf (WebAssembly, top-level await) must stay out of the workflow bundle.
export async function measurePdfLooks(pdf: Uint8Array): Promise<PageLook[]> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  try {
    const out: PageLook[] = [];
    const total = doc.countPages();
    for (let i = 0; i < total; i++) {
      const page = doc.loadPage(i);
      const [x0, , x1] = page.getBounds();
      const scale = LOOK_WIDTH_PX / (x1 - x0);
      const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
      out.push(
        measurePageLook({
          width: pix.getWidth(),
          height: pix.getHeight(),
          channels: pix.getNumberOfComponents(),
          data: pix.getPixels(),
        }),
      );
      pix.destroy();
      page.destroy();
    }
    return out;
  } finally {
    doc.destroy();
  }
}
