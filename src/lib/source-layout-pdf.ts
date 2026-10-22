import {
  analyzeStextPage,
  designColors,
  furnitureKeys,
  hasBackgroundImage,
  isPlainShape,
  rasterPictureBoxes,
  stripFurniture,
  type SourcePageLayout,
  type StextBlock,
  type VectorPath,
} from "@/lib/source-layout";
import { measureNumberMarks, measureTopBand } from "@/lib/design/page-furniture";

const RASTER_WIDTH_PX = 600; // enough to see a gutter between comic panels
const COLOUR_WIDTH_PX = 120; // design colours need no detail (Faz G1)
// A page of map hatching or a pattern can paint hundreds of thousands of
// shapes; past this many the page is art throughout and more add nothing.
const MAX_VECTOR_PATHS = 20000;
const FURNITURE_WIDTH_PX = 500; // a 2 mm band, and enough strong pixels in a thin coloured exercise numeral

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
      const vectorPaths = collectVectorPaths(mupdf, page, page.getBounds());
      const layout = analyzeStextPage({ ...stripFurniture(sp, furniture), rasterImages, vectorPaths });
      // Page furniture: the top band and the exercise number badges.
      const furnitureScale = FURNITURE_WIDTH_PX / sp.width;
      const mid = page.toPixmap(mupdf.Matrix.scale(furnitureScale, furnitureScale), mupdf.ColorSpace.DeviceRGB, false, true);
      const midRaster = { width: mid.getWidth(), height: mid.getHeight(), channels: mid.getNumberOfComponents(), data: mid.getPixels() };
      const topBand = measureTopBand(midRaster);
      const marks = measureNumberMarks(midRaster, layout.exerciseNumbers ?? []);
      mid.destroy();
      if (topBand || marks.numberBadge || marks.trackColor) layout.furniture = { ...(topBand ? { topBand } : {}), ...marks };
      const colourScale = COLOUR_WIDTH_PX / sp.width;
      const small = page.toPixmap(mupdf.Matrix.scale(colourScale, colourScale), mupdf.ColorSpace.DeviceRGB, false, true);
      // The band is the page's frame, not its palette (it lives in furniture):
      // left in, a yellow edge strip outvoted the red of every heading badge.
      const band = topBand ? [{ x: 0, y: 0, w: 1, h: Math.max(topBand.heightRatio, topBand.tab?.heightRatio ?? 0) + 0.005 }] : [];
      layout.designColors = designColors(
        { width: small.getWidth(), height: small.getHeight(), channels: small.getNumberOfComponents(), data: small.getPixels() },
        [...layout.images, ...band],
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

type Mupdf = typeof import("mupdf");
type Path = import("mupdf").Path;
type Rect = [number, number, number, number];

// Every filled or stroked shape the page paints, as a box (fraction of the
// page) clipped to what is visible. Shapes drawn into a soft mask are the
// mask's definition, not ink, and are skipped.
function collectVectorPaths(mupdf: Mupdf, page: ReturnType<InstanceType<Mupdf["Document"]>["loadPage"]>, bounds: Rect): VectorPath[] {
  const [px0, py0, px1, py1] = bounds;
  const W = px1 - px0;
  const H = py1 - py0;
  const out: VectorPath[] = [];
  const clips: Rect[] = [bounds];
  const masks: Rect[] = [];
  const top = () => clips[clips.length - 1];
  const clip = (r: Rect): Rect => {
    const t = top();
    return [Math.max(r[0], t[0]), Math.max(r[1], t[1]), Math.min(r[2], t[2]), Math.min(r[3], t[3])];
  };
  const add = (path: Path, ctm: number[], r: Rect, cs: { getNumberOfComponents(): number; isCMYK(): boolean } | null, color: number[], alpha: number) => {
    if (masks.length || alpha < 0.1 || out.length >= MAX_VECTOR_PATHS) return;
    const [a, b, c, d] = clip(r);
    if (c <= a || d <= b) return;
    // The path's points on the page (a rectangle under a rotating ctm is a
    // tilted shape, not a cell).
    const points: ([number, number] | null)[] = [];
    const point = (x: number, y: number) => void points.push([ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]]);
    path.walk({ moveTo: point, lineTo: point, curveTo: () => void points.push(null) });
    out.push({
      box: { x: (a - px0) / W, y: (b - py0) / H, w: (c - a) / W, h: (d - b) / H },
      paper: isPaperColor(cs, color),
      plain: isPlainShape(points),
    });
  };
  const device = new mupdf.Device({
    fillPath: (path, _evenOdd, ctm, cs, color, alpha) => add(path, ctm, path.getBounds(null as never, ctm) as Rect, cs, color, alpha),
    strokePath: (path, stroke, ctm, cs, color, alpha) => add(path, ctm, path.getBounds(stroke, ctm) as Rect, cs, color, alpha),
    clipPath: (path, _evenOdd, ctm) => void clips.push(clip(path.getBounds(null as never, ctm) as Rect)),
    clipStrokePath: (path, stroke, ctm) => void clips.push(clip(path.getBounds(stroke, ctm) as Rect)),
    clipText: () => void clips.push(top()),
    clipStrokeText: () => void clips.push(top()),
    clipImageMask: () => void clips.push(top()),
    popClip: () => void (clips.length > 1 && clips.pop()),
    // A soft mask is drawn between beginMask and endMask, then clips like a
    // path until its popClip.
    beginMask: (area) => void masks.push(area as Rect),
    endMask: () => void clips.push(clip(masks.pop() ?? top())),
  });
  try {
    page.run(device, mupdf.Matrix.identity);
    device.close();
  } finally {
    device.destroy();
  }
  return out;
}

// Paper-coloured paint (white in gray/RGB, no ink in CMYK) prints nothing.
function isPaperColor(cs: { getNumberOfComponents(): number; isCMYK(): boolean } | null, color: number[]): boolean {
  if (!cs || !color.length) return false;
  if (cs.isCMYK()) return color.every((v) => v <= 0.05);
  const n = cs.getNumberOfComponents();
  return (n === 1 || n === 3) && color.every((v) => v >= 0.95);
}
