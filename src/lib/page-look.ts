import type { Box } from "@/lib/source-layout";

// Faz G5 (audit 2026-10-18): the fidelity score counted pictures, exercises
// and columns only, so a white page of framed cards could score 78% against
// a full-colour photo collage. This measures what a page *looks* like from a
// low-resolution rendering - colours, how colourful, how much of the page is
// printed and where - so look and structure are scored separately.
//
// Pure functions over RGB(A) pixels; rendering lives in page-look-pdf.ts.

export type Pixels = { width: number; height: number; channels: number; data: Uint8Array | Uint8ClampedArray };

export const LOOK_GRID = { cols: 12, rows: 16 } as const;
const HUE_BINS = 12;

export type PageLook = {
  // Share of the page in each colour bin: [white, light grey, dark grey,
  // black, then 12 hues] - sums to 1.
  palette: number[];
  // Mean saturation of the printed (non-white) pixels, 0-1.
  colourfulness: number;
  // Share of the page that is not paper-white, 0-1.
  ink: number;
  // Ink share in each cell of a 12×16 grid, row by row.
  inkGrid: number[];
};

const isPaper = (r: number, g: number, b: number) => r > 235 && g > 235 && b > 235;

function colourBin(r: number, g: number, b: number): { bin: number; sat: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  if (sat < 0.18 || max < 40) {
    // neutrals by lightness
    if (isPaper(r, g, b)) return { bin: 0, sat };
    if (max > 160) return { bin: 1, sat };
    if (max > 60) return { bin: 2, sat };
    return { bin: 3, sat };
  }
  let h: number;
  const d = max - min;
  if (max === r) h = ((g - b) / d + 6) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { bin: 4 + (Math.floor((h / 6) * HUE_BINS) % HUE_BINS), sat };
}

export function measurePageLook(px: Pixels): PageLook {
  const { width: W, height: H, channels: C, data } = px;
  const palette = new Array(4 + HUE_BINS).fill(0);
  const gridInk = new Array(LOOK_GRID.cols * LOOK_GRID.rows).fill(0);
  const gridAll = new Array(LOOK_GRID.cols * LOOK_GRID.rows).fill(0);
  let inkCount = 0;
  let satSum = 0;
  for (let y = 0; y < H; y++) {
    const gy = Math.min(LOOK_GRID.rows - 1, Math.floor((y / H) * LOOK_GRID.rows));
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const { bin, sat } = colourBin(r, g, b);
      palette[bin]++;
      const cell = gy * LOOK_GRID.cols + Math.min(LOOK_GRID.cols - 1, Math.floor((x / W) * LOOK_GRID.cols));
      gridAll[cell]++;
      if (bin !== 0) {
        inkCount++;
        satSum += sat;
        gridInk[cell]++;
      }
    }
  }
  const total = W * H || 1;
  return {
    palette: palette.map((n) => n / total),
    colourfulness: inkCount ? satSum / inkCount : 0,
    ink: inkCount / total,
    inkGrid: gridInk.map((n, i) => (gridAll[i] ? n / gridAll[i] : 0)),
  };
}

export type LookAspect = "palette" | "colourfulness" | "ink" | "inkMap" | "pictureArea";

const closeness = (a: number, b: number) => (a === b ? 1 : 1 - Math.abs(a - b) / Math.max(a, b, 1e-9));

// Histogram intersection of the printed colours only (paper left out and the
// rest renormalised): the share of colour both pages have in common. With
// paper included, a nearly white page scored high against any page with
// some white on it (calibration 2026-10-18); how much is printed is the
// "ink" aspect. Null when neither page has any ink.
function paletteSimilarity(a: number[], b: number[]): number | null {
  const inkOnly = (p: number[]) => {
    const total = p.slice(1).reduce((s, v) => s + v, 0);
    return total ? p.slice(1).map((v) => v / total) : null;
  };
  const pa = inkOnly(a);
  const pb = inkOnly(b);
  if (!pa && !pb) return null;
  if (!pa || !pb) return 0;
  return pa.reduce((s, v, i) => s + Math.min(v, pb[i]), 0);
}

// Bray-Curtis similarity of the two ink maps: 1 when the same cells are
// printed equally, 0 when nothing overlaps. Null when both pages are blank.
function mapSimilarity(a: number[], b: number[]): number | null {
  let diff = 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    diff += Math.abs(a[i] - (b[i] ?? 0));
    sum += a[i] + (b[i] ?? 0);
  }
  return sum ? 1 - diff / sum : null;
}

// Picture boxes rasterised onto the same grid; the score is the overlap
// (intersection over union) of the areas covered by pictures. Null when
// neither page has a picture - "not applicable", not a perfect match.
export function pictureAreaOverlap(a: Box[], b: Box[], cols = 48, rows = 64): number | null {
  const mask = (boxes: Box[]) => {
    const m = new Uint8Array(cols * rows);
    for (const bx of boxes) {
      const c0 = Math.max(0, Math.floor(bx.x * cols));
      const c1 = Math.min(cols, Math.ceil((bx.x + bx.w) * cols));
      const r0 = Math.max(0, Math.floor(bx.y * rows));
      const r1 = Math.min(rows, Math.ceil((bx.y + bx.h) * rows));
      for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) m[r * cols + c] = 1;
    }
    return m;
  };
  const ma = mask(a);
  const mb = mask(b);
  let inter = 0;
  let union = 0;
  for (let i = 0; i < ma.length; i++) {
    if (ma[i] && mb[i]) inter++;
    if (ma[i] || mb[i]) union++;
  }
  return union ? inter / union : null;
}

export function compareLooks(
  a: PageLook,
  b: PageLook,
  pictures: [Box[], Box[]],
): Record<LookAspect, number | null> {
  return {
    palette: paletteSimilarity(a.palette, b.palette),
    colourfulness: a.ink || b.ink ? closeness(a.colourfulness, b.colourfulness) : null,
    ink: closeness(a.ink, b.ink),
    inkMap: mapSimilarity(a.inkGrid, b.inkGrid),
    pictureArea: pictureAreaOverlap(pictures[0], pictures[1]),
  };
}
