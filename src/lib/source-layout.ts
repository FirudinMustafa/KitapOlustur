// Faz B1 "Kaynağın formatını yakalamak": measures each source page's layout
// straight from the PDF (mupdf structured text) instead of asking a model to
// describe it. Free, deterministic and exact where the model only guessed a
// coarse "layoutZone": how many pictures a page carries and where, how many
// text columns, how dense, how many numbered exercises, the trim size.
//
// Boxes are fractions of the page (0-1), so they carry over to any trim size
// and never reproduce the source's literal coordinates.

export type Box = { x: number; y: number; w: number; h: number };

export type LayoutZone =
  | "image_top_text_bottom"
  | "image_bottom_text_top"
  | "image_left_text_right"
  | "image_right_text_left"
  | "two_column"
  | "full_width_text"
  | "full_width_image";

export type SourcePageLayout = {
  widthPt: number;
  heightPt: number;
  // Content pictures in reading order (top-to-bottom, then left-to-right).
  // Page backgrounds, edge strips and small icons are left out.
  images: Box[];
  textColumns: 1 | 2 | 3;
  wordCount: number;
  // Numbered exercise headings ("1 Listen and repeat."): a number printed
  // clearly larger than the body text. Item numbers inside an exercise are
  // body-sized and counted in itemCount instead.
  exerciseCount: number;
  itemCount: number;
  // The instruction line of each exercise heading, in reading order - input
  // for classifying exercise formats, never printed.
  exerciseRubrics: string[];
  bodyFontPt: number | null;
  headingFontPt: number | null;
  zone: LayoutZone;
};

// The subset of mupdf's StructuredText.asJSON() this module reads.
type StextLine = { text: string; bbox?: Box; font?: { size?: number; weight?: string } };
export type StextBlock =
  | { type: "image"; bbox: Box }
  | { type: "text"; bbox: Box; lines: StextLine[] };
// rasterImages: picture boxes found in a rendering of the page (fractions,
// see rasterPictureBoxes) - for pages whose artwork is flattened into one
// page-sized image.
export type StextPage = { width: number; height: number; blocks: StextBlock[]; rasterImages?: Box[] };

const BACKGROUND_AREA = 0.6; // an image covering more than this is the page background
const STRIP_FRACTION = 0.06; // thinner than this (of the page side) is a strip, rule or icon bar
const ICON_AREA = 0.004; // smaller than this is an icon or bullet

// A full-width band glued to the top or bottom edge is a running header /
// footer graphic, not a picture.
function isEdgeBand(b: Box): boolean {
  return b.w >= 0.85 && b.h <= 0.15 && (b.y <= 0.02 || b.y + b.h >= 0.98);
}

export function analyzeStextPage(page: StextPage): SourcePageLayout {
  const { width: W, height: H } = page;
  const norm = (b: Box): Box => {
    const x = Math.max(0, b.x) / W;
    const y = Math.max(0, b.y) / H;
    return { x, y, w: Math.min(b.w / W, 1 - x), h: Math.min(b.h / H, 1 - y) };
  };

  const images = dedupeNested(
    page.blocks
      .filter((b): b is Extract<StextBlock, { type: "image" }> => b.type === "image")
      .map((b) => norm(b.bbox))
      .filter((b) => b.w * b.h <= BACKGROUND_AREA)
      // A rendered region may cover most of the page: an edge-to-edge
      // illustration (comic panels with no gutter) is one big picture.
      .concat(page.rasterImages ?? [])
      .filter((b) => b.w >= STRIP_FRACTION && b.h >= STRIP_FRACTION && b.w * b.h >= ICON_AREA && !isEdgeBand(b)),
  ).sort((a, b) => (Math.abs(a.y - b.y) < 0.05 ? a.x - b.x : a.y - b.y));

  const textBlocks = page.blocks.filter((b): b is Extract<StextBlock, { type: "text" }> => b.type === "text");
  const lines = textBlocks.flatMap((b) => b.lines.map((l) => ({ ...l, block: b })));
  const wordsOf = (t: string) => t.split(/\s+/).filter(Boolean).length;
  const wordCount = lines.reduce((s, l) => s + wordsOf(l.text), 0);

  // Body size = the size carrying the most characters; heading = the most
  // common size clearly above it.
  const charsBySize = new Map<number, number>();
  for (const l of lines) {
    const size = Math.round((l.font?.size ?? 0) * 2) / 2;
    if (size > 0) charsBySize.set(size, (charsBySize.get(size) ?? 0) + l.text.trim().length);
  }
  const bySize = [...charsBySize.entries()].sort((a, b) => b[1] - a[1]);
  const bodyFontPt = bySize[0]?.[0] ?? null;
  const headingFontPt = bodyFontPt ? (bySize.find(([size]) => size >= bodyFontPt * 1.25)?.[0] ?? null) : null;

  const numbered = lines.filter((l) => {
    // "1 ", "1." and "1)" - generated books number items "1.".
    if (!/^\d{1,2}[.)]?(\s|$)/.test(l.text.trim())) return false;
    const y = (l.bbox ?? l.block.bbox).y / H;
    return y >= 0.06 && y <= 0.94; // not the folio
  });
  const isHeadingNumber = (l: StextLine) => bodyFontPt !== null && (l.font?.size ?? 0) >= bodyFontPt * 1.15;
  const headings = numbered.filter(isHeadingNumber);
  const exerciseCount = headings.length;
  const itemCount = numbered.length - headings.length;
  // The rubric is the rest of the heading line, or the block's next line
  // when the number stands alone.
  const exerciseRubrics = headings
    .map((l) => {
      const rest = l.text.trim().replace(/^\d{1,2}[.)]?\s*/, "");
      if (rest) return rest;
      const blockLines = l.block.lines;
      const at = blockLines.findIndex((bl) => bl.text === l.text && bl.bbox === l.bbox);
      return blockLines[at + 1]?.text.trim() ?? "";
    })
    .map((t) => t.slice(0, 120));

  const textColumns = countColumns(textBlocks.map((b) => ({ box: norm(b.bbox), words: wordsOf(b.lines.map((l) => l.text).join(" ")) })));

  return {
    widthPt: Math.round(W),
    heightPt: Math.round(H),
    images,
    textColumns,
    wordCount,
    exerciseCount,
    itemCount,
    exerciseRubrics,
    bodyFontPt,
    headingFontPt,
    zone: classifyZone(images, textColumns),
  };
}

// Live comparison 2026-10-14 (i_5_team_2.pdf): 12 of 25 pages carry their
// artwork flattened into one page-sized image - a three-panel comic, a
// classroom photo - which the background filter above drops, so 10 of those
// pages counted 0 pictures. Such a page is rendered and its pictures found
// from the pixels instead.
export function hasBackgroundImage(page: StextPage): boolean {
  return page.blocks.some((b) => b.type === "image" && (b.bbox.w * b.bbox.h) / (page.width * page.height) > BACKGROUND_AREA);
}

export type Raster = { width: number; height: number; channels: number; data: ArrayLike<number> };

const CELL = 0.0125; // grid cell, as a fraction of the page width
const BUSY_STD = 22; // colour spread (0-255) above which a cell is picture, not flat fill
const MIN_FILL = 0.4; // share of a region's box its busy cells must cover (an outline is not a picture)
// Rendered regions smaller than this are badges, title lettering and
// ornaments, not pictures a page is built around.
const RASTER_MIN_AREA = 0.025;
const RASTER_MIN_SIDE = 0.1;

// Picture regions of a rendered page: a grid of cells, each marked "busy"
// when its pixels outside the text vary like artwork rather than a flat
// background tint; busy cells are joined (gaps of one cell closed) into
// regions, and each region's box is a picture. Rules, frames and answer
// lines come out as thin or hollow regions and are dropped here or by the
// usual strip/icon filters.
export function rasterPictureBoxes(raster: Raster, page: Pick<StextPage, "width" | "height" | "blocks">): Box[] {
  const { width: RW, height: RH, channels: C, data } = raster;
  const cellPx = Math.max(2, Math.round(RW * CELL));
  const cols = Math.ceil(RW / cellPx);
  const rows = Math.ceil(RH / cellPx);
  const sx = RW / page.width;
  const sy = RH / page.height;
  const text = page.blocks
    .filter((b) => b.type === "text")
    .map((b) => ({ x0: b.bbox.x * sx, y0: b.bbox.y * sy, x1: (b.bbox.x + b.bbox.w) * sx, y1: (b.bbox.y + b.bbox.h) * sy }));
  const inText = (x: number, y: number) => text.some((t) => x >= t.x0 && x < t.x1 && y >= t.y0 && y < t.y1);

  const busy: boolean[] = new Array(cols * rows).fill(false);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let n = 0;
      const sum = [0, 0, 0];
      const sq = [0, 0, 0];
      for (let y = r * cellPx; y < Math.min(RH, (r + 1) * cellPx); y++) {
        for (let x = c * cellPx; x < Math.min(RW, (c + 1) * cellPx); x++) {
          if (inText(x, y)) continue;
          const i = (y * RW + x) * C;
          for (let k = 0; k < 3; k++) {
            const v = data[i + k];
            sum[k] += v;
            sq[k] += v * v;
          }
          n++;
        }
      }
      if (n < (cellPx * cellPx) / 3) continue;
      const std = Math.sqrt([0, 1, 2].reduce((s, k) => s + (sq[k] / n - (sum[k] / n) ** 2), 0) / 3);
      busy[r * cols + c] = std >= BUSY_STD;
    }
  }

  const boxes: Box[] = [];
  const toBox = (r0: number, r1: number, c0: number, c1: number): Box => {
    const x = (c0 * cellPx) / RW;
    const y = (r0 * cellPx) / RH;
    return { x, y, w: Math.min(1 - x, ((c1 - c0 + 1) * cellPx) / RW), h: Math.min(1 - y, ((r1 - r0 + 1) * cellPx) / RH) };
  };
  xyCut(busy, cols, 0, rows - 1, 0, cols - 1, (r0, r1, c0, c1, filled) => {
    if (filled < MIN_FILL * (r1 - r0 + 1) * (c1 - c0 + 1)) return;
    const box = toBox(r0, r1, c0, c1);
    if (box.w * box.h >= RASTER_MIN_AREA && box.w >= RASTER_MIN_SIDE && box.h >= RASTER_MIN_SIDE) boxes.push(box);
  });
  return boxes;
}

const GUTTER = 0.12; // a row/column with less than this share busy separates two regions

// Recursive XY-cut: trims the region to its busy cells, then splits it at
// the first run of near-empty rows (or columns) - the white gutter between
// comic panels, between a photo and the exercises under it - and recurses.
// A region with no gutter left is a leaf.
function xyCut(
  busy: boolean[],
  cols: number,
  r0: number,
  r1: number,
  c0: number,
  c1: number,
  leaf: (r0: number, r1: number, c0: number, c1: number, filled: number) => void,
): void {
  const rowFill = (r: number) => {
    let n = 0;
    for (let c = c0; c <= c1; c++) if (busy[r * cols + c]) n++;
    return n;
  };
  const colFill = (c: number) => {
    let n = 0;
    for (let r = r0; r <= r1; r++) if (busy[r * cols + c]) n++;
    return n;
  };
  while (r0 <= r1 && rowFill(r0) === 0) r0++;
  while (r1 >= r0 && rowFill(r1) === 0) r1--;
  while (c0 <= c1 && colFill(c0) === 0) c0++;
  while (c1 >= c0 && colFill(c1) === 0) c1--;
  if (r0 > r1 || c0 > c1) return;

  const width = c1 - c0 + 1;
  const height = r1 - r0 + 1;
  for (let r = r0 + 1; r < r1; r++) {
    if (rowFill(r) < GUTTER * width) {
      xyCut(busy, cols, r0, r - 1, c0, c1, leaf);
      xyCut(busy, cols, r + 1, r1, c0, c1, leaf);
      return;
    }
  }
  for (let c = c0 + 1; c < c1; c++) {
    if (colFill(c) < GUTTER * height) {
      xyCut(busy, cols, r0, r1, c0, c - 1, leaf);
      xyCut(busy, cols, r0, r1, c + 1, c1, leaf);
      return;
    }
  }
  let filled = 0;
  for (let r = r0; r <= r1; r++) filled += rowFill(r);
  leaf(r0, r1, c0, c1, filled);
}

// Drops a box that lies (mostly) inside a bigger one - a framed picture is
// often stored as frame + picture.
function dedupeNested(boxes: Box[]): Box[] {
  const sorted = [...boxes].sort((a, b) => b.w * b.h - a.w * a.h);
  const kept: Box[] = [];
  for (const b of sorted) {
    if (kept.some((k) => overlap(k, b) >= 0.8 * b.w * b.h)) continue;
    kept.push(b);
  }
  return kept;
}

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

// Text columns from where the words sit horizontally: word mass per 1% of
// page width, then runs of occupied width separated by a gutter. A run
// counts as a column only if it carries a real share of the words.
function countColumns(blocks: { box: Box; words: number }[]): 1 | 2 | 3 {
  const bins = new Array(100).fill(0);
  let total = 0;
  for (const { box, words } of blocks) {
    if (words < 3) continue;
    const from = Math.floor(box.x * 100);
    const to = Math.min(99, Math.ceil((box.x + box.w) * 100) - 1);
    const per = words / Math.max(1, to - from + 1);
    for (let i = from; i <= to; i++) bins[i] += per;
    total += words;
  }
  if (!total) return 1;
  const max = Math.max(...bins);
  const runs: { from: number; to: number; mass: number }[] = [];
  for (let i = 0; i < 100; i++) {
    if (bins[i] <= max * 0.08) continue;
    const last = runs[runs.length - 1];
    if (last && i - last.to <= 1) {
      last.to = i;
      last.mass += bins[i];
    } else runs.push({ from: i, to: i, mass: bins[i] });
  }
  const columns = runs.filter((r) => r.mass >= total * 0.15).length;
  return Math.min(3, Math.max(1, columns)) as 1 | 2 | 3;
}

function classifyZone(images: Box[], textColumns: number): LayoutZone {
  const largest = [...images].sort((a, b) => b.w * b.h - a.w * a.h)[0];
  if (!largest) return textColumns >= 2 ? "two_column" : "full_width_text";
  if (largest.w * largest.h >= 0.45) return "full_width_image";
  if (largest.w >= 0.6) return largest.y + largest.h / 2 < 0.5 ? "image_top_text_bottom" : "image_bottom_text_top";
  return largest.x + largest.w / 2 < 0.5 ? "image_left_text_right" : "image_right_text_left";
}

// The trim size most pages share, in points (books mix in odd-sized covers).
export function dominantTrim(layouts: SourcePageLayout[]): { widthPt: number; heightPt: number } | null {
  const counts = new Map<string, number>();
  for (const l of layouts) {
    const key = `${l.widthPt}x${l.heightPt}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  const [widthPt, heightPt] = top[0].split("x").map(Number);
  return { widthPt, heightPt };
}
