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
  // Exercises done with the recording (isListeningRubric), and the audio
  // track numbers printed next to them. Optional: page maps stored before
  // 2026-10-21 lack them.
  listeningCount?: number;
  trackNumbers?: string[];
  bodyFontPt: number | null;
  headingFontPt: number | null;
  zone: LayoutZone;
  // Faz G1: the source's own look. Font names without the subset prefix
  // ("PFCatalog-Regular"); designColors are the colours printed outside
  // the pictures - bands, panels, headings, number badges - as shares of
  // the page. Optional: page maps stored before G1 lack them.
  bodyFontName?: string | null;
  headingFontName?: string | null;
  designColors?: DesignColor[];
};

export type DesignColor = { hex: string; share: number };

// The subset of mupdf's StructuredText.asJSON() this module reads.
type StextLine = { text: string; bbox?: Box; font?: { name?: string; size?: number; weight?: string } };
export type StextBlock =
  | { type: "image"; bbox: Box }
  | { type: "text"; bbox: Box; lines: StextLine[] };
// rasterImages: picture boxes found in a rendering of the page (fractions,
// see rasterPictureBoxes) - for pages whose artwork is flattened into one
// page-sized image. vectorPaths: the page's filled and stroked shapes (see
// vectorPictureBoxes) - for artwork drawn as vectors, not stored as images.
export type StextPage = { width: number; height: number; blocks: StextBlock[]; rasterImages?: Box[]; vectorPaths?: VectorPath[] };

const BACKGROUND_AREA = 0.6; // an image covering more than this is the page background
const STRIP_FRACTION = 0.06; // thinner than this (of the page side) is a strip, rule or icon bar
const ICON_AREA = 0.004; // smaller than this is an icon or bullet

// An image covering most of the page is its background - unless it sits
// inside the margins on all four sides: that is a big framed picture.
// Super Minds p.12 (2026-10-21): a classroom illustration inset in the
// margins (66% of the page) was dropped as a background, the rendering
// found no busy cells in its soft painted shading, and the page counted no
// picture at all.
const INSET_MARGIN = 0.02;
function isBackground(b: Box): boolean {
  if (b.w * b.h <= BACKGROUND_AREA) return false;
  // (mupdf reports some degenerate image boxes with both sides negative;
  // those stay backgrounds, as before.)
  const inset =
    b.w > 0 && b.h > 0 && b.x >= INSET_MARGIN && b.y >= INSET_MARGIN && b.x + b.w <= 1 - INSET_MARGIN && b.y + b.h <= 1 - INSET_MARGIN;
  return !inset;
}

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

  const rasters = dedupeNested(
    page.blocks
      .filter((b): b is Extract<StextBlock, { type: "image" }> => b.type === "image")
      .map((b) => norm(b.bbox))
      .filter((b) => !isBackground(b))
      // A rendered region may cover most of the page: an edge-to-edge
      // illustration (comic panels with no gutter) is one big picture.
      .concat(page.rasterImages ?? [])
      .filter((b) => b.w >= STRIP_FRACTION && b.h >= STRIP_FRACTION && b.w * b.h >= ICON_AREA && !isEdgeBand(b)),
  );
  const vectors = page.vectorPaths ? vectorPictureBoxes(page.vectorPaths, page, rasters) : [];
  const images = [...rasters, ...vectors].sort((a, b) => (Math.abs(a.y - b.y) < 0.05 ? a.x - b.x : a.y - b.y));

  const textBlocks = page.blocks.filter((b): b is Extract<StextBlock, { type: "text" }> => b.type === "text");
  // Text drawn several times in one place (an outlined or shadowed title -
  // Kid's Box prints "Starters Listening" five times over) is read once;
  // otherwise it outweighs the real body text when picking the body size.
  const drawnAt = new Set<string>();
  const lines = textBlocks
    .flatMap((b) => b.lines.map((l) => ({ ...l, block: b })))
    .filter((l) => {
      const b = l.bbox ?? l.block.bbox;
      const key = `${l.text.trim()}@${Math.round(b.x / 4)},${Math.round(b.y / 4)}`;
      if (drawnAt.has(key)) return false;
      drawnAt.add(key);
      return true;
    });
  const wordsOf = (t: string) => t.split(/\s+/).filter(Boolean).length;
  const wordCount = lines.reduce((s, l) => s + wordsOf(l.text), 0);

  // Body size = the size carrying the most characters; heading = the most
  // common size clearly above it. A bold line opening with a number is an
  // exercise heading and is left out: mupdf gives a line one font (its first
  // character's), so a heading with its rubric run on ("3 What's the
  // subject? Look, choose and write.") counted every rubric character at
  // the number's size - enough, on a page of short items, to make that the
  // "body" size and hide every heading (Faz G4).
  const charsBySize = new Map<number, number>();
  const isHeadingLine = (l: StextLine) => l.font?.weight === "bold" && /^\d{1,2}[.)]?\s/.test(l.text.trim());
  for (const l of lines) {
    const size = Math.round((l.font?.size ?? 0) * 2) / 2;
    if (size > 0 && !isHeadingLine(l)) charsBySize.set(size, (charsBySize.get(size) ?? 0) + l.text.trim().length);
  }
  const bySize = [...charsBySize.entries()].sort((a, b) => b[1] - a[1]);
  const bodyFontPt = bySize[0]?.[0] ?? null;
  const headingFontPt = bodyFontPt ? (bySize.find(([size]) => size >= bodyFontPt * 1.25)?.[0] ?? null) : null;
  // The face carrying the most body-size text, and the one carrying the
  // most text clearly above it.
  const faceOf = (pick: (size: number) => boolean) => {
    const chars = new Map<string, number>();
    for (const l of lines) {
      const name = l.font?.name?.replace(/^[A-Z]{6}\+/, "");
      if (name && pick(l.font?.size ?? 0)) chars.set(name, (chars.get(name) ?? 0) + l.text.trim().length);
    }
    return [...chars.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  const bodyFontName = bodyFontPt ? faceOf((s) => Math.abs(s - bodyFontPt) <= 0.5) : null;
  const headingFontName = bodyFontPt ? faceOf((s) => s >= bodyFontPt * 1.15) : null;

  const numbered = lines.filter((l) => {
    // "1 ", "1." and "1)" - generated books number items "1.". A zero-padded
    // "03" is an audio track number, never an exercise or item.
    if (!/^\d{1,2}[.)]?(\s|$)/.test(l.text.trim()) || /^0\d/.test(l.text.trim())) return false;
    const y = (l.bbox ?? l.block.bbox).y / H;
    return y >= 0.06 && y <= 0.94; // not the folio
  });
  const isHeadingNumber = (l: StextLine) => bodyFontPt !== null && (l.font?.size ?? 0) >= bodyFontPt * 1.15;
  const candidates = numbered.filter(isHeadingNumber);
  // The rubric is the rest of the heading line, or the block's next lines
  // when the number stands alone. Coursebooks print an audio track number
  // between the exercise number and the rubric ("1 03 Listen and point.",
  // Super Minds; "1 [headphones] 3 Listen and colour.", Kid's Box), often as
  // its own small line - it is taken off the rubric and kept as the track.
  // A heading drawn twice a few points apart (a coloured copy over its
  // outline) reads as the same number with the same rubric.
  const seenHeading = new Set<string>();
  const read = candidates
    .map((l) => ({ line: l, ...readRubric(l) }))
    .filter((r) => {
      if (!r.rubric) return true;
      const key = `${r.line.text.trim()}|${r.rubric}`;
      if (seenHeading.has(key)) return false;
      seenHeading.add(key);
      return true;
    });
  // A young learners' page has little body text, so the big numbers on its
  // pictures ("1 2 3" under six photos) clear the heading size too. An
  // exercise has words after its number; a bare number counts as one only
  // at the size the page's worded headings are printed at.
  const headingSizes = new Set(read.filter((r) => /[A-Za-z]/.test(r.rubric)).map((r) => Math.round(r.line.font?.size ?? 0)));
  const headings = headingSizes.size
    ? read.filter((r) => /[A-Za-z]/.test(r.rubric) || (!r.rubric && headingSizes.has(Math.round(r.line.font?.size ?? 0))))
    : read;
  const exerciseCount = headings.length;
  const itemCount = numbered.length - headings.length;
  const trackNumbers = headings.flatMap((h) => (h.track ? [h.track] : []));
  const exerciseRubrics = headings.map((h) => h.rubric);
  const listeningCount = exerciseRubrics.filter(isListeningRubric).length;

  function readRubric(l: (typeof lines)[number]): { rubric: string; track: string | null } {
    let rest = l.text.trim().replace(/^\d{1,2}[.)]?\s*/, "");
    const ownLine = !rest;
    if (ownLine) {
      const blockLines = l.block.lines;
      const at = blockLines.findIndex((bl) => bl.text === l.text && bl.bbox === l.bbox);
      // Up to the first line with words - past a track number on its own.
      const following: string[] = [];
      for (const bl of blockLines.slice(at + 1, at + 4)) {
        following.push(bl.text.trim());
        if (/[A-Za-z]/.test(bl.text)) break;
      }
      rest = following.join(" ").replace(/\s+/g, " ").trim();
    }
    // On the heading's own line only a zero-padded number is a track
    // ("1 03 Listen"); "1 10 words" is a rubric.
    const track = rest.match(ownLine ? /^(\d{1,3})\s+(?=\S*[A-Za-z])/ : /^(0\d{1,2})\s+(?=\S*[A-Za-z])/);
    if (track) rest = rest.slice(track[0].length);
    return { rubric: rest.slice(0, 120), track: track?.[1] ?? null };
  }

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
    listeningCount,
    ...(trackNumbers.length ? { trackNumbers } : {}),
    bodyFontPt,
    headingFontPt,
    bodyFontName,
    headingFontName,
    zone: classifyZone(images, textColumns),
  };
}

// An exercise the class does with the recording: "Listen and point",
// "Watch and listen to the story", "Listen and sing", "Say the chant".
export function isListeningRubric(rubric: string): boolean {
  return /\b(listen|listening|sing|chant)\b/i.test(rubric);
}

// Page furniture (2026-10-21): text printed in the same place on most pages -
// a running head, a copyright line, a publisher's "Excerpt" watermark band
// (every page of the Cambridge sample units carries five such lines). It is
// not the book's content: it must not count as words, exercises or fonts,
// nor reach the writer as source text. Lines are compared with digits
// masked, so "Unit 3" and "Unit 4" running heads match.
const FURNITURE_TOP = 0.12;
const FURNITURE_BOTTOM = 0.9;
const FURNITURE_SHARE = 0.6;

export function furnitureKey(text: string): string {
  return text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

// Keys of the lines that sit in the top or bottom band of at least 60% of
// the pages (3 pages minimum - two pages say nothing about a pattern). A
// bare number is a folio, which the analysis already places by position.
export function furnitureKeys(pages: Pick<StextPage, "height" | "blocks">[]): Set<string> {
  if (pages.length < 3) return new Set();
  const counts = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    for (const block of page.blocks) {
      if (block.type !== "text") continue;
      for (const l of block.lines) {
        const y = (l.bbox ?? block.bbox).y / page.height;
        if (y > FURNITURE_TOP && y < FURNITURE_BOTTOM) continue;
        const key = furnitureKey(l.text);
        if (key && key !== "#") seen.add(key);
      }
    }
    for (const key of seen) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const min = Math.ceil(pages.length * FURNITURE_SHARE);
  return new Set([...counts].filter(([, n]) => n >= min).map(([key]) => key));
}

// The page without its furniture lines (only where they sit in the bands).
export function stripFurniture<P extends Pick<StextPage, "height" | "blocks">>(page: P, keys: Set<string>): P {
  if (!keys.size) return page;
  const blocks: StextBlock[] = [];
  for (const block of page.blocks) {
    if (block.type !== "text") {
      blocks.push(block);
      continue;
    }
    const lines = block.lines.filter((l) => {
      const y = (l.bbox ?? block.bbox).y / page.height;
      return (y > FURNITURE_TOP && y < FURNITURE_BOTTOM) || !keys.has(furnitureKey(l.text));
    });
    if (lines.length) blocks.push(lines.length === block.lines.length ? block : { ...block, lines });
  }
  return { ...page, blocks };
}

// Faz G1: the colours a page prints outside its pictures, clustered (4 bits
// per channel, then averaged), chromatic ones only - paper, greys and black
// text say nothing about a book's design. Shares are of the whole page.
export function designColors(raster: Raster, pictures: Box[], max = 8): DesignColor[] {
  const { width: W, height: H, channels: C, data } = raster;
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = x / W;
      const fy = y / H;
      if (pictures.some((p) => fx >= p.x && fx <= p.x + p.w && fy >= p.y && fy <= p.y + p.h)) continue;
      const i = (y * W + x) * C;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const hi = Math.max(r, g, b);
      const lo = Math.min(r, g, b);
      if (hi - lo < 28 || hi < 50) continue; // grey, black or paper
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++;
      e.r += r;
      e.g += g;
      e.b += b;
      bins.set(key, e);
    }
  }
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return [...bins.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((e) => ({ hex: `#${hex(e.r / e.n)}${hex(e.g / e.n)}${hex(e.b / e.n)}`, share: e.n / (W * H) }))
    .filter((c) => c.share >= 0.001);
}

// Live comparison 2026-10-14 (i_5_team_2.pdf): 12 of 25 pages carry their
// artwork flattened into one page-sized image - a three-panel comic, a
// classroom photo - which the background filter above drops, so 10 of those
// pages counted 0 pictures. Such a page is rendered and its pictures found
// from the pixels instead.
export function hasBackgroundImage(page: StextPage): boolean {
  return page.blocks.some(
    (b) => b.type === "image" && isBackground({ x: b.bbox.x / page.width, y: b.bbox.y / page.height, w: b.bbox.w / page.width, h: b.bbox.h / page.height }),
  );
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

// Artwork drawn as vector shapes, not stored as an image: Super Minds p.7
// (ten kites, ten number tiles) and p.6 (six pencils) are paths, so the
// image blocks above saw nothing and the writer was told "pictures: 0".
// box is a fraction of the page, clipped to what is visible; paper marks a
// shape painted in the paper colour (white knock-outs, invisible in print);
// plain a single straight segment or an axis-aligned rectangle - a rule,
// frame side, table cell, panel, band or answer box, never artwork
// (i_5_team_2 p.4: the contents table's empty cells joined into a
// "picture"; kids-box p.10: the sides of two dashed drawing frames).
export type VectorPath = { box: Box; paper?: boolean; plain?: boolean };

// A path given as its points (null = a curve segment) is plain: one
// straight segment, or four or five points with no curves and every edge
// horizontal or vertical.
export function isPlainShape(points: ([number, number] | null)[]): boolean {
  if (points.includes(null)) return false;
  if (points.length === 2) return true;
  if (points.length < 4 || points.length > 5) return false;
  const pts = points as [number, number][];
  const eps = 0.01;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    if (Math.abs(ax - bx) > eps && Math.abs(ay - by) > eps) return false;
  }
  return true;
}

const VECTOR_LINE = 0.004; // thinner than this (of the page side) is a rule or answer line
const CONTAINER_AREA = 0.06; // one shape bigger than this is a panel, frame or tint, not artwork
const FOLIO_BAND = 0.06; // shapes wholly inside the top/bottom band are running header/footer graphics
const PANEL_WORDS = 3; // a shape with this many words on it is a text panel or word box
const OBJECT_GAP = 0.012; // shapes closer than this are pieces of one drawing
const MIN_PATHS = 3; // a lone drawing has this many shapes; fewer is a badge, card or swatch
const ROW_ITEMS = 4; // this many drawings side by side are one picture strip (a row of kites)
const STACK_GAP = 0.04; // strips closer than this, one above the other, are one picture band
const MAX_TEXT_SHARE = 0.3; // a region this much covered by text is a table or panel

// Picture boxes from a page's vector shapes. Shapes that cannot be artwork
// are dropped first (rules, rectangles, panels, header/footer graphics,
// white knock-outs, frames around raster pictures, badges behind numbers,
// boxes holding text); the rest are joined into drawings by proximity. A drawing
// of several shapes is a picture; drawings in a row of ROW_ITEMS or more
// become one strip, and stacked strips one band - the zone plan keeps six
// pictures at most, and ten kites are one picture area, not ten. Every box
// then passes the raster pictures' size, fill and edge-band filters.
export function vectorPictureBoxes(paths: VectorPath[], page: Pick<StextPage, "width" | "height" | "blocks">, rasters: Box[] = []): Box[] {
  const { width: W, height: H } = page;
  const lines = page.blocks
    .filter((b): b is Extract<StextBlock, { type: "text" }> => b.type === "text")
    .flatMap((b) =>
      b.lines.map((l) => {
        const bb = l.bbox ?? b.bbox;
        return { box: { x: bb.x / W, y: bb.y / H, w: bb.w / W, h: bb.h / H }, words: l.text.split(/\s+/).filter(Boolean).length };
      }),
    );
  const wordsIn = (b: Box) => lines.reduce((n, l) => (centreIn(l.box, b) ? n + l.words : n), 0);
  const area = (b: Box) => b.w * b.h;

  const shapes = paths
    .filter((p) => !p.paper && !p.plain)
    .map((p) => p.box)
    .filter(
      (b) =>
        Math.min(b.w, b.h) >= VECTOR_LINE &&
        area(b) <= CONTAINER_AREA &&
        b.y + b.h > FOLIO_BAND &&
        b.y < 1 - FOLIO_BAND &&
        !rasters.some((r) => centreIn(b, r)) &&
        !(area(b) < ICON_AREA && lines.some((l) => overlap(l.box, b) > 0)) &&
        wordsIn(b) < PANEL_WORDS,
    );
  const worded = new Set(shapes.filter((b) => wordsIn(b) > 0));

  // A drawing whose shapes mostly carry words is a table or a set of word
  // cards (cells joined edge to edge), not artwork; a kite carries its
  // number on one shape of several.
  const objects = groupNear(shapes, OBJECT_GAP).filter((o) => {
    if (area(o.box) < ICON_AREA) return false;
    if (o.members.filter((m) => worded.has(m)).length * 2 >= o.members.length && wordsIn(o.box) > 0) return false;
    return o.members.length >= MIN_PATHS || wordsIn(o.box) === 0;
  });

  // Rows by vertical overlap, as the zone plan groups pictures.
  const rows: Drawing[][] = [];
  for (const o of [...objects].sort((a, b) => a.box.y - b.box.y)) {
    const row = rows.find((r) => r.some((m) => verticalOverlap(m.box, o.box) >= 0.4 * Math.min(m.box.h, o.box.h)));
    if (row) row.push(o);
    else rows.push([o]);
  }
  const strips: Drawing[] = [];
  const singles: Drawing[] = [];
  for (const row of rows) {
    if (row.length >= ROW_ITEMS) strips.push(mergeDrawings(row));
    else singles.push(...row.filter((o) => o.members.length >= MIN_PATHS));
  }
  // Stacked strips (two rows of five kites) are one band.
  strips.sort((a, b) => a.box.y - b.box.y);
  for (let i = 0; i + 1 < strips.length; ) {
    const a = strips[i].box;
    const b = strips[i + 1].box;
    const gap = b.y - (a.y + a.h);
    const shared = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    if (gap <= STACK_GAP && shared >= 0.6 * Math.min(a.w, b.w)) strips.splice(i, 2, mergeDrawings([strips[i], strips[i + 1]]));
    else i++;
  }

  const textShare = (b: Box) => lines.reduce((s, l) => s + overlap(l.box, b), 0) / area(b);
  const pictures = [...strips, ...singles]
    .filter(({ box, members }) => {
      if (area(box) < RASTER_MIN_AREA || box.w < RASTER_MIN_SIDE || box.h < RASTER_MIN_SIDE) return false;
      if (isEdgeBand(box) || isBackground(box) || isEdgeCorner(box)) return false;
      if (rasters.some((r) => overlap(r, box) >= 0.3 * Math.min(area(r), area(box)))) return false;
      return coverage(box, members) >= MIN_FILL && textShare(box) < MAX_TEXT_SHARE;
    })
    .map((d) => d.box);
  return dedupeNested(pictures);
}

type Drawing = { box: Box; members: Box[] };

// Vector shapes bleeding off the top or bottom edge within the header or
// footer depth are a unit tab or corner ornament (i_5_team_2 pp.6/10/14:
// puzzle pieces in the top corner; p.18: the "1d Skills work" tab).
const EDGE_GRAPHIC_DEPTH = 0.15;
function isEdgeCorner(b: Box): boolean {
  return (b.y <= 0.01 && b.y + b.h <= EDGE_GRAPHIC_DEPTH) || (b.y + b.h >= 0.99 && b.y >= 1 - EDGE_GRAPHIC_DEPTH);
}

function centreIn(inner: Box, outer: Box): boolean {
  const cx = inner.x + inner.w / 2;
  const cy = inner.y + inner.h / 2;
  return cx >= outer.x && cx <= outer.x + outer.w && cy >= outer.y && cy <= outer.y + outer.h;
}

function verticalOverlap(a: Box, b: Box): number {
  return Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
}

function union(boxes: Box[]): Box {
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function mergeDrawings(ds: Drawing[]): Drawing {
  return { box: union(ds.map((d) => d.box)), members: ds.flatMap((d) => d.members) };
}

// Boxes no further apart than `gap` (on both axes) end up in one group -
// union-find over a coarse bucket grid, so an illustration of thousands of
// shapes stays fast.
export function groupNear(boxes: Box[], gap: number): Drawing[] {
  const parent = boxes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const near = (a: Box, b: Box) =>
    a.x - gap <= b.x + b.w && b.x - gap <= a.x + a.w && a.y - gap <= b.y + b.h && b.y - gap <= a.y + a.h;
  const BUCKET = 0.05;
  const buckets = new Map<number, number[]>();
  boxes.forEach((b, i) => {
    const c0 = Math.floor((b.x - gap) / BUCKET);
    const c1 = Math.floor((b.x + b.w + gap) / BUCKET);
    const r0 = Math.floor((b.y - gap) / BUCKET);
    const r1 = Math.floor((b.y + b.h + gap) / BUCKET);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const key = (r + 100) * 1000 + (c + 100);
        const list = buckets.get(key) ?? [];
        for (const j of list) if (find(i) !== find(j) && near(b, boxes[j])) parent[find(i)] = find(j);
        list.push(i);
        buckets.set(key, list);
      }
    }
  });
  const groups = new Map<number, Box[]>();
  boxes.forEach((b, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), b]);
  });
  return [...groups.values()].map((members) => ({ box: union(members), members }));
}

// Share of a box's grid cells (CELL of the page) that its shapes cover -
// a ring of ornaments around an empty frame is not a picture.
function coverage(box: Box, members: Box[]): number {
  const cols = Math.max(1, Math.round(box.w / CELL));
  const rows = Math.max(1, Math.round(box.h / CELL));
  const hit = new Uint8Array(cols * rows);
  for (const m of members) {
    const c0 = Math.max(0, Math.floor(((m.x - box.x) / box.w) * cols));
    const c1 = Math.min(cols - 1, Math.ceil(((m.x + m.w - box.x) / box.w) * cols) - 1);
    const r0 = Math.max(0, Math.floor(((m.y - box.y) / box.h) * rows));
    const r1 = Math.min(rows - 1, Math.ceil(((m.y + m.h - box.y) / box.h) * rows) - 1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) hit[r * cols + c] = 1;
  }
  return hit.reduce((s, v) => s + v, 0) / hit.length;
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
