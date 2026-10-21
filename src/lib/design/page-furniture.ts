import type { Box, Raster, SourcePageLayout } from "@/lib/source-layout";

// Page furniture (KIYAS-13 review): what a coursebook prints on every page
// around the content - a coloured band across the top edge, each exercise
// number on a filled circle, the audio track on a pill of its own colour.
// Measured from a rendering of the source page; the analyzer leaves edge
// bands out of the pictures, so without this they were lost altogether.
//
// Pure - the rendering is done by source-layout-pdf.ts.

export type TopBand = {
  /** The strip across the whole width. */
  color: string;
  /** Height as a share of the page height. */
  heightRatio: number;
  /** A taller strip of a second colour from the outer edge (Super Minds: red over yellow). */
  tab?: { color: string; widthRatio: number; heightRatio: number };
};

export type PageFurniture = {
  topBand?: TopBand;
  /** The exercise number's colour; filled = a badge (white number on a disc), else a coloured numeral. */
  numberBadge?: { color: string; filled: boolean };
  /** The audio track pill's colour. */
  trackColor?: string;
};

type Rgb = [number, number, number];

const isChromatic = ([r, g, b]: Rgb) => Math.max(r, g, b) - Math.min(r, g, b) >= 28 && Math.max(r, g, b) >= 50;
const hex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const rgbOf = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const NEAR = 60;

function pixel(raster: Raster, x: number, y: number): Rgb {
  const i = (y * raster.width + x) * raster.channels;
  return [raster.data[i], raster.data[i + 1], raster.data[i + 2]];
}

// The most common chromatic colour of a set of pixels (4-bit bins,
// averaged), and the share of the pixels that are chromatic at all. The
// edges of a thin coloured numeral blend into the paper (i5 Team's red
// figures came out pink), so when there are enough strong pixels only they
// vote.
const STRONG = 80;
const chroma = ([r, g, b]: Rgb) => Math.max(r, g, b) - Math.min(r, g, b);

function dominant(pixels: Rgb[], skip?: Rgb): { color: Rgb | null; share: number } {
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  const coloured = pixels.filter(isChromatic);
  const strong = coloured.filter((p) => chroma(p) >= STRONG);
  const voters = strong.length >= Math.max(3, coloured.length * 0.1) ? strong : coloured;
  const chromatic = coloured.length;
  for (const p of voters) {
    if (skip && distance(p, skip) < NEAR) continue;
    const key = ((p[0] >> 4) << 8) | ((p[1] >> 4) << 4) | (p[2] >> 4);
    const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += p[0];
    e.g += p[1];
    e.b += p[2];
    bins.set(key, e);
  }
  const top = [...bins.values()].sort((a, b) => b.n - a.n)[0];
  return { color: top ? [top.r / top.n, top.g / top.n, top.b / top.n] : null, share: pixels.length ? chromatic / pixels.length : 0 };
}

const BAND_ROW = 0.85; // a band row is this chromatic across the page
const BAND_MAX = 0.04; // taller than this from the edge is a picture bleeding off the top
const TAB_MIN_WIDTH = 0.15;

// The band across the top edge: rows from the very top that are coloured
// nearly edge to edge, then (optionally) rows where a run of colour still
// reaches in from one side - the tab.
export function measureTopBand(raster: Raster): TopBand | null {
  const { width: W, height: H } = raster;
  const row = (y: number) => Array.from({ length: W }, (_, x) => pixel(raster, x, y));
  const share = (px: Rgb[]) => px.filter(isChromatic).length / W;
  let y = 0;
  while (y < Math.ceil(H * 0.01) && share(row(y)) < BAND_ROW) y++;
  const start = y;
  while (y < H && share(row(y)) >= BAND_ROW) y++;
  const bandRows = y - start;
  if (start > 0 && bandRows < 2) return null;
  if (bandRows < Math.max(1, H * 0.004) || y > H * BAND_MAX) return null;

  // Tab rows: a coloured run from one edge, at least TAB_MIN_WIDTH wide.
  const tabRows: { color: Rgb | null; width: number }[] = [];
  for (; y < H * BAND_MAX * 1.5; y++) {
    const px = row(y);
    const runFrom = (xs: number[]) => {
      let n = 0;
      for (const x of xs) {
        if (!isChromatic(px[x])) break;
        n++;
      }
      return n;
    };
    // a hairline at the very edge (a picture's border) is skipped
    const left = runFrom(Array.from({ length: W - 2 }, (_, i) => i + 2));
    const right = runFrom(Array.from({ length: W - 2 }, (_, i) => W - 3 - i));
    const run = Math.max(left, right);
    if (run < W * TAB_MIN_WIDTH || run > W * BAND_ROW) break;
    const from = left >= right ? 2 : W - 2 - run;
    tabRows.push({ color: dominant(px.slice(from, from + run)).color, width: run / W });
  }
  const bandPixels = Array.from({ length: bandRows }, (_, i) => row(start + i)).flat();
  const tabColor = tabRows.length >= 2 ? dominant(tabRows.flatMap((t) => (t.color ? [t.color] : []))).color : null;
  const band = dominant(bandPixels, tabColor ?? undefined).color ?? dominant(bandPixels).color;
  if (!band) return null;
  return {
    color: hex(band),
    heightRatio: round(bandRows / H),
    ...(tabColor && distance(tabColor, band) >= NEAR
      ? {
          tab: {
            color: hex(tabColor),
            widthRatio: round(tabRows.reduce((n, t) => n + t.width, 0) / tabRows.length),
            heightRatio: round((bandRows + tabRows.length) / H),
          },
        }
      : {}),
  };
}

const round = (v: number) => Math.round(v * 1000) / 1000;

export type NumberMark = { box: Box; digits: number; track: boolean };

// The colour around each exercise number, and the colour of the pill right
// of it when the exercise has an audio track. A number printed on a disc
// leaves the disc's colour around the (white) figure; a coloured numeral on
// paper leaves a thin share of colour.
export function measureNumberMarks(raster: Raster, marks: NumberMark[]): Pick<PageFurniture, "numberBadge" | "trackColor"> {
  const { width: W, height: H } = raster;
  const area = (x0: number, y0: number, x1: number, y1: number) => {
    const px: Rgb[] = [];
    for (let y = Math.max(0, Math.floor(y0 * H)); y < Math.min(H, Math.ceil(y1 * H)); y++)
      for (let x = Math.max(0, Math.floor(x0 * W)); x < Math.min(W, Math.ceil(x1 * W)); x++) px.push(pixel(raster, x, y));
    return px;
  };
  const badges: { color: Rgb; filled: boolean }[] = [];
  const tracks: Rgb[] = [];
  for (const { box, digits, track } of marks) {
    // The figure's square: the line is as tall as the number; a heading run
    // on with its rubric has a much wider box than the number itself.
    const side = box.h * (H / W); // the line height, as a share of the width
    const numW = Math.min(box.w, side * (digits > 1 ? 1.3 : 0.9));
    const cx = box.x + numW / 2;
    const cy = box.y + box.h / 2;
    const r = Math.max(numW, side) * 0.6;
    const around = dominant(area(cx - r, cy - (r * W) / H, cx + r, cy + (r * W) / H));
    if (around.color) badges.push({ color: around.color, filled: around.share >= 0.35 });
    if (track) {
      const pill = dominant(area(cx + r, box.y, cx + r + side * 2.4, box.y + box.h), around.color ?? undefined);
      if (pill.color && pill.share >= 0.15) tracks.push(pill.color);
    }
  }
  const badge = mostCommon(badges.map((b) => b.color));
  return {
    ...(badge
      ? { numberBadge: { color: hex(badge), filled: badges.filter((b) => distance(b.color, badge) < NEAR && b.filled).length * 2 >= badges.filter((b) => distance(b.color, badge) < NEAR).length } }
      : {}),
    ...(tracks.length ? { trackColor: hex(mostCommon(tracks)!) } : {}),
  };
}

// The colour most of the samples are near (each sample votes for every
// sample within NEAR of it), averaged over its neighbours.
function mostCommon(colors: Rgb[]): Rgb | null {
  let best: Rgb[] = [];
  for (const c of colors) {
    const near = colors.filter((o) => distance(o, c) < NEAR);
    if (near.length > best.length) best = near;
  }
  if (!best.length) return null;
  return [0, 1, 2].map((k) => best.reduce((n, c) => n + c[k], 0) / best.length) as Rgb;
}

// Book level: what most measured pages print. A band on fewer than half of
// the pages is a unit opener's or a picture's, not the book's.
export function deriveFurniture(layouts: Pick<SourcePageLayout, "furniture">[]): PageFurniture | null {
  const pages = layouts.map((l) => l.furniture).filter((f): f is PageFurniture => !!f);
  if (layouts.length < 2) return null;
  const out: PageFurniture = {};

  const bands = pages.flatMap((p) => (p.topBand ? [p.topBand] : []));
  if (bands.length * 2 >= layouts.length && bands.length >= 2) {
    const color = mostCommon(bands.map((b) => rgbOf(b.color)))!;
    const same = bands.filter((b) => distance(rgbOf(b.color), color) < NEAR);
    const tabs = same.flatMap((b) => (b.tab ? [b.tab] : []));
    const tabColor = tabs.length * 2 >= same.length ? mostCommon(tabs.map((t) => rgbOf(t.color))) : null;
    const tabSame = tabColor ? tabs.filter((t) => distance(rgbOf(t.color), tabColor) < NEAR) : [];
    out.topBand = {
      color: hex(color),
      heightRatio: median(same.map((b) => b.heightRatio)),
      ...(tabColor && tabSame.length
        ? { tab: { color: hex(tabColor), widthRatio: median(tabSame.map((t) => t.widthRatio)), heightRatio: median(tabSame.map((t) => t.heightRatio)) } }
        : {}),
    };
  }

  const badges = pages.flatMap((p) => (p.numberBadge ? [p.numberBadge] : []));
  const badge = mostCommon(badges.map((b) => rgbOf(b.color)));
  if (badge) {
    const same = badges.filter((b) => distance(rgbOf(b.color), badge) < NEAR);
    out.numberBadge = { color: hex(badge), filled: same.filter((b) => b.filled).length * 2 >= same.length };
  }
  const track = mostCommon(pages.flatMap((p) => (p.trackColor ? [rgbOf(p.trackColor)] : [])));
  if (track) out.trackColor = hex(track);

  return Object.keys(out).length ? out : null;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
