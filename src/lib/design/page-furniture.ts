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
  /** Page level only (deriveFurniture leaves it out): the colour the page is printed on, or its side panel. */
  ground?: PageGround;
  /** Book level: the source prints lesson furniture (lesson-furniture.ts hasLessonFurniture). */
  lessons?: boolean;
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
export function deriveFurniture(layouts: Pick<SourcePageLayout, "furniture" | "exerciseNumbers">[]): PageFurniture | null {
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
  const same = badge ? badges.filter((b) => distance(rgbOf(b.color), badge) < NEAR) : [];
  // Like the band: the style of most numbered pages, not of a few (black
  // numerals on tinted panels measure as a pale badge on those pages only).
  const numbered = layouts.filter((l) => l.exerciseNumbers?.length).length;
  if (badge && same.length >= 2 && same.length * 2 >= numbered) {
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

// The ground as printed under our text: the book's body text is near-black,
// so a dark ground (i5 p.23's navy panel, which the source fills with white
// boxes and white type) is lifted toward white until black text keeps a
// 4.5:1 contrast on it. Lighter grounds print as measured.
const MIN_GROUND_LUMINANCE = 0.18;

function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function legibleGround(color: string): string {
  const rgb = rgbOf(color);
  for (let t = 0; t <= 1; t += 0.05) {
    const mixed = rgb.map((v) => v + (255 - v) * t) as Rgb;
    if (luminance(mixed) >= MIN_GROUND_LUMINANCE) return hex(mixed);
  }
  return "#ffffff";
}

// ---- Page ground and side panel (2026-10-24, hand-made i5 comparison) ----
//
// Teen coursebooks print most pages on colour: i5 Team 2 p.6 sits on a lime
// ground, p.10 has a purple panel down its right half. Ours printed white,
// so ink and palette scored 44% / 56% against the source while a hand-set
// version of the same pages scored 82% / 67%. Measured on a grid of cells
// outside the pictures: a cell whose pixels are mostly one colour shows that
// colour (text and art make busy cells, which do not vote). An earlier try
// sampled a ring at the page edge and missed a gradient ground and a
// half-page panel.

export type PageGround = {
  color: string;
  /**
   * Where the colour is printed, as fractions of the page; an edge within
   * GROUND_EDGE of the page's is snapped to it (the colour bleeds off).
   * {0,0,1,1} is a page printed on colour all over.
   */
  box: Box;
};

const GROUND_CELLS = { cols: 20, rows: 26 } as const;
const CELL_SOLID = 0.55; // share of a cell's pixels near its commonest colour for the cell to show a colour
const GROUND_NEAR = 56; // one ground: a gradient or a printed pattern stays within this distance
const GROUND_MIN_CELLS = 0.08; // the colour shows in at least this share of the page's cells
const GROUND_TRIM = 0.02; // stray cells (a picture's edge) left out of the colour's extent on each side
const GROUND_FILL = 0.3; // the colour's share of the solid cells inside its extent
const GROUND_OUTSIDE = 0.1; // ...and at most this share of the solid cells outside it
const GROUND_EDGE = 0.1; // an extent this close to the page edge reaches it
const GROUND_MIN_SIDE = 0.25; // a panel narrower or shorter than this is a box, not a ground

const paperLike = ([r, g, b]: Rgb) => r > 235 && g > 235 && b > 235;

type GroundCell = { cx: number; cy: number; color: Rgb | null };

export function groundCells(raster: Raster, pictures: Box[]): GroundCell[] {
  const { width: W, height: H } = raster;
  const { cols, rows } = GROUND_CELLS;
  const cells: GroundCell[] = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const cx = (gx + 0.5) / cols;
      const cy = (gy + 0.5) / rows;
      if (pictures.some((p) => cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h)) continue;
      const px: Rgb[] = [];
      for (let y = Math.floor((gy / rows) * H); y < Math.floor(((gy + 1) / rows) * H); y++)
        for (let x = Math.floor((gx / cols) * W); x < Math.floor(((gx + 1) / cols) * W); x++) px.push(pixel(raster, x, y));
      if (!px.length) continue;
      const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
      for (const p of px) {
        const key = ((p[0] >> 4) << 8) | ((p[1] >> 4) << 4) | (p[2] >> 4);
        const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
        e.n++;
        e.r += p[0];
        e.g += p[1];
        e.b += p[2];
        bins.set(key, e);
      }
      const top = [...bins.values()].sort((a, b) => b.n - a.n)[0];
      const mean: Rgb = [top.r / top.n, top.g / top.n, top.b / top.n];
      // Pixels near the commonest colour, not only in its bin: a bin edge splits a flat tint.
      const near = px.filter((p) => distance(p, mean) < 24).length;
      cells.push({ cx, cy, color: near / px.length >= CELL_SOLID ? mean : null });
    }
  }
  return cells;
}

export function measurePageGround(raster: Raster, pictures: Box[]): PageGround | null {
  const { cols, rows } = GROUND_CELLS;
  const minCells = cols * rows * GROUND_MIN_CELLS;
  const cells = groundCells(raster, pictures);
  const inked = cells.flatMap((c) => (c.color && !paperLike(c.color) ? [c.color] : []));
  // The printed colours among the solid cells, commonest first.
  const clusters: Rgb[][] = [];
  for (const c of inked) {
    const near = clusters.find((k) => distance(k[0], c) < GROUND_NEAR);
    if (near) near.push(c);
    else clusters.push([c]);
  }
  clusters.sort((a, b) => b.length - a.length);
  const solid = cells.filter((c) => !!c.color);
  const at = (v: number[], q: number) => v[Math.min(v.length - 1, Math.max(0, Math.floor(q * v.length)))];
  const snap = (v: number, edge: number) => (Math.abs(v - edge) <= GROUND_EDGE ? edge : v);
  for (const cluster of clusters.slice(0, 3)) {
    if (cluster.length < minCells) break;
    const color = [0, 1, 2].map((k) => cluster.reduce((n, c) => n + c[k], 0) / cluster.length) as Rgb;
    const isGround = (c: GroundCell) => !!c.color && !paperLike(c.color) && distance(c.color, color) < GROUND_NEAR;
    const mine = cells.filter(isGround);
    if (mine.length < minCells) continue;
    // The colour's extent, without the few cells furthest out on each side.
    const xs = mine.map((c) => c.cx).sort((a, b) => a - b);
    const ys = mine.map((c) => c.cy).sort((a, b) => a - b);
    const x0 = snap(at(xs, GROUND_TRIM) - 0.5 / cols, 0);
    const x1 = snap(at(xs, 1 - GROUND_TRIM) + 0.5 / cols, 1);
    const y0 = snap(at(ys, GROUND_TRIM) - 0.5 / rows, 0);
    const y1 = snap(at(ys, 1 - GROUND_TRIM) + 0.5 / rows, 1);
    // A ground or panel reaches the page edge on three sides at least: a
    // full-width band at the top or foot, a full-height panel at a side.
    const edges = [x0 === 0, x1 === 1, y0 === 0, y1 === 1].filter(Boolean).length;
    if (edges < 3 || x1 - x0 < GROUND_MIN_SIDE || y1 - y0 < GROUND_MIN_SIDE) continue;
    const inBox = (c: GroundCell) => c.cx >= x0 && c.cx <= x1 && c.cy >= y0 && c.cy <= y1;
    const inside = solid.filter(inBox);
    const outside = solid.filter((c) => !inBox(c));
    if (inside.filter(isGround).length < inside.length * GROUND_FILL) continue;
    if (outside.filter(isGround).length > outside.length * GROUND_OUTSIDE) continue;
    return { color: hex(color), box: { x: round(x0), y: round(y0), w: round(x1 - x0), h: round(y1 - y0) } };
  }
  return null;
}
