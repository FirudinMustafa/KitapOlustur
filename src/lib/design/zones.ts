import type { SourcePageLayout } from "@/lib/source-layout";
// Faz B2 "Kaynağa göre yerleşim": a generated page laid out like its source
// page. The source page's measured layout (src/lib/source-layout.ts) is
// reduced to a stack of horizontal bands - a row of pictures, a picture
// beside text, or plain text in one or two columns - in the source's order
// and proportions. Bands are fractions of the content area, so they carry
// over to any trim size without reproducing the source's coordinates.
//
// Pure TS, no react-pdf/Node imports - shared by the PDF renderer
// (templates.tsx), the web reader (PageContent.tsx) and the fit estimate.

export type ZoneBand =
  // A row of pictures; widths are fractions of the row. Faz G3: the row
  // sits where the source's does - `left` and `span` are fractions of the
  // content width (unset = the full width, as plans stored before G3).
  | { kind: "pictures"; height: number; widths: number[]; left?: number; span?: number }
  // Pictures stacked in a side column, text flowing beside them.
  | { kind: "split"; side: "left" | "right"; imageWidth: number; height: number; pictures: number }
  // Text only; `weight` is the band's share of the source page's text area.
  | { kind: "text"; columns: 1 | 2; weight: number }
  // Two independent columns, each a stack of pictures and text - the usual
  // coursebook page, where a picture sits inside one column with text above
  // and below it.
  | { kind: "columns"; columns: [ColumnItem[], ColumnItem[]] };

export type ColumnItem = { kind: "picture"; height: number } | { kind: "text"; weight: number };

export type ZonePlan = { bands: ZoneBand[] };

export const MAX_ZONE_PICTURES = 6;

const ROW_OVERLAP = 0.4; // vertical overlap (of the smaller box) that puts two pictures in one row
const MIN_TEXT_GAP = 0.06; // a vertical gap smaller than this between pictures carries no text band

type Box = SourcePageLayout["images"][number];

export function zonePictureCount(plan: ZonePlan): number {
  return plan.bands.reduce((n, b) => {
    if (b.kind === "pictures") return n + b.widths.length;
    if (b.kind === "split") return n + b.pictures;
    if (b.kind === "columns") return n + b.columns.flat().filter((i) => i.kind === "picture").length;
    return n;
  }, 0);
}

// A source page without pictures is still laid out like its source: its
// text in the source's one or two columns, printed frameless. Live test
// 2026-10-12: such pages went to the framed templates, ran over and came
// out as two half-empty sheets each.
export function buildZonePlan(layout: SourcePageLayout): ZonePlan | null {
  const images = layout.images.slice(0, MAX_ZONE_PICTURES);
  if (!images.length) return { bands: [{ kind: "text", columns: layout.textColumns >= 2 ? 2 : 1, weight: 1 }] };
  if (layout.textColumns >= 2) return buildColumnPlan(images);
  const columns = 1 as const;

  // Group pictures into rows by vertical overlap.
  const rows: Box[][] = [];
  for (const img of [...images].sort((a, b) => a.y - b.y)) {
    const row = rows.find((r) => r.some((o) => verticalOverlap(o, img) >= ROW_OVERLAP * Math.min(o.h, img.h)));
    if (row) row.push(img);
    else rows.push([img]);
  }

  const bands: ZoneBand[] = [];
  let cursor = 0;
  const pushText = (from: number, to: number) => {
    if (to - from >= MIN_TEXT_GAP) bands.push({ kind: "text", columns, weight: to - from });
  };
  for (const row of rows.map((r) => r.sort((a, b) => a.x - b.x))) {
    const top = Math.min(...row.map((b) => b.y));
    const bottom = Math.max(...row.map((b) => b.y + b.h));
    const left = Math.min(...row.map((b) => b.x));
    const right = Math.max(...row.map((b) => b.x + b.w));
    const height = clamp(bottom - top, 0.1, 0.5);
    pushText(cursor, top);
    if (right - left >= 0.55) {
      const total = row.reduce((n, b) => n + b.w, 0);
      bands.push({ kind: "pictures", height, widths: row.map((b) => b.w / total), ...rowSpan(left, right) });
    } else {
      bands.push({
        kind: "split",
        side: left + (right - left) / 2 < 0.5 ? "left" : "right",
        imageWidth: clamp(right - left, 0.25, 0.55),
        height,
        pictures: row.length,
      });
    }
    cursor = Math.max(cursor, bottom);
  }
  pushText(cursor, 1);

  // Pictures may not crowd out the page's text: scale them down so they
  // take at most 60% of the height.
  const pictureHeight = bands.reduce((n, b) => n + (b.kind === "pictures" || b.kind === "split" ? b.height : 0), 0);
  if (pictureHeight > 0.6) {
    const k = 0.6 / pictureHeight;
    for (const b of bands) if (b.kind === "pictures" || b.kind === "split") b.height = Math.round(b.height * k * 1000) / 1000;
  }
  // Text must have somewhere to go.
  if (!bands.some((b) => b.kind !== "pictures")) bands.push({ kind: "text", columns, weight: 0.3 });
  return { bands };
}

const SPANNING = 0.55; // a picture wider than this spans both columns

// Two-column source page: pictures inside a column stay in that column,
// pictures spanning the page become full-width rows between column runs.
function buildColumnPlan(images: Box[]): ZonePlan {
  const spanning = images.filter((b) => b.w >= SPANNING).sort((a, b) => a.y - b.y);
  const inColumn = images.filter((b) => b.w < SPANNING);
  const bands: ZoneBand[] = [];
  const columnsBetween = (from: number, to: number) => {
    const cols: [ColumnItem[], ColumnItem[]] = [[], []];
    const inside = inColumn.filter((b) => b.y + b.h / 2 >= from && b.y + b.h / 2 < to);
    for (const side of [0, 1] as const) {
      let cursor = from;
      for (const b of inside.filter((i) => (i.x + i.w / 2 < 0.5 ? 0 : 1) === side).sort((a, c) => a.y - c.y)) {
        if (b.y - cursor >= MIN_TEXT_GAP) cols[side].push({ kind: "text", weight: b.y - cursor });
        cols[side].push({ kind: "picture", height: clamp(b.h, 0.1, 0.5) });
        cursor = Math.max(cursor, b.y + b.h);
      }
      if (to - cursor >= MIN_TEXT_GAP) cols[side].push({ kind: "text", weight: to - cursor });
    }
    if (cols.some((c) => c.some((i) => i.kind === "picture"))) bands.push({ kind: "columns", columns: cols });
    else if (to - from >= MIN_TEXT_GAP) bands.push({ kind: "text", columns: 2, weight: to - from });
  };
  let cursor = 0;
  for (const b of spanning) {
    columnsBetween(cursor, b.y);
    bands.push({ kind: "pictures", height: clamp(b.h, 0.1, 0.5), widths: [1], ...rowSpan(b.x, b.x + b.w) });
    cursor = Math.max(cursor, b.y + b.h);
  }
  columnsBetween(cursor, 1);

  // Same 60% cap as the row plan, measured down the fuller column.
  const full = bands.reduce((n, b) => n + (b.kind === "pictures" ? b.height : 0), 0);
  const perColumn = [0, 1].map((side) =>
    bands.reduce((n, b) => n + (b.kind === "columns" ? b.columns[side].reduce((m, i) => m + (i.kind === "picture" ? i.height : 0), 0) : 0), 0),
  );
  const tallest = full + Math.max(...perColumn);
  if (tallest > 0.6) {
    const k = 0.6 / tallest;
    for (const b of bands) {
      if (b.kind === "pictures") b.height = Math.round(b.height * k * 1000) / 1000;
      if (b.kind === "columns") for (const col of b.columns) for (const i of col) if (i.kind === "picture") i.height = Math.round(i.height * k * 1000) / 1000;
    }
  }
  if (!bands.some((b) => b.kind === "text" || b.kind === "columns")) bands.push({ kind: "text", columns: 2, weight: 0.3 });
  return { bands };
}

// The row's horizontal extent; a row that (nearly) fills the page width is
// left at the full content width.
function rowSpan(left: number, right: number): { left?: number; span?: number } {
  const span = Math.min(1, right - left);
  if (span >= 0.9) return {};
  return { left: Math.round(clamp(left, 0, 1 - span) * 1000) / 1000, span: Math.round(span * 1000) / 1000 };
}

function verticalOverlap(a: Box, b: Box): number {
  return Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// ---- Laying content into a plan ----

export type ZonedItem<B> = { kind: "picture"; height: number; picture: number } | { kind: "text"; blocks: B[] };

export type ZonedBand<B> =
  | { kind: "pictures"; height: number; widths: number[]; pictures: number[]; left?: number; span?: number }
  | { kind: "split"; side: "left" | "right"; imageWidth: number; height: number; pictures: number[]; blocks: B[] }
  | { kind: "text"; columns: 1 | 2; blocks: B[] }
  | { kind: "columns"; columns: [ZonedItem<B>[], ZonedItem<B>[]] };

type SlottedItem = { kind: "picture"; height: number; picture: number } | { kind: "text"; text: number };
type Slotted =
  | { kind: "pictures"; height: number; widths: number[]; pictures: number[]; left?: number; span?: number }
  | { kind: "split"; side: "left" | "right"; imageWidth: number; height: number; pictures: number[]; text: number }
  | { kind: "text"; columns: 1 | 2; text: number }
  | { kind: "columns"; columns: SlottedItem[][] };

// Puts the page's pictures (indexes into the page's image list, main picture
// first) into the plan's picture slots in order, and spreads its blocks over
// the text areas in reading order (down the left column before the right),
// each area taking a share proportional to its size in the source. A picture
// slot with no picture left is dropped (a split band then turns into text),
// and an empty text area disappears - so the result never prints an empty
// frame.
export function layoutZones<B>(plan: ZonePlan, blocks: B[], pictureCount: number, weightOf: (b: B) => number): ZonedBand<B>[] {
  // Picture slots in reading order with their size. The page's main picture
  // (imagePrompt, index 0 - the scene) goes into the largest slot, as in
  // the source; the others fill the remaining slots in reading order.
  const slotAreas = plan.bands.flatMap((band) => {
    if (band.kind === "pictures") return band.widths.map((w) => band.height * w);
    if (band.kind === "split") return Array.from({ length: band.pictures }, () => (band.height * band.imageWidth) / band.pictures);
    if (band.kind === "columns") return band.columns.flat().flatMap((i) => (i.kind === "picture" ? [i.height * 0.5] : []));
    return [];
  });
  const assignment: (number | undefined)[] = slotAreas.map(() => undefined);
  if (pictureCount > 0 && slotAreas.length) {
    const largest = slotAreas.indexOf(Math.max(...slotAreas));
    assignment[largest] = 0;
    let p = 1;
    for (let i = 0; i < assignment.length && p < pictureCount; i++) if (i !== largest) assignment[i] = p++;
  }
  let slot = 0;
  const take = (n: number) => {
    const out: number[] = [];
    for (let k = 0; k < n; k++, slot++) if (assignment[slot] !== undefined) out.push(assignment[slot]!);
    return out;
  };

  // Text areas in reading order; each band refers to its areas by index.
  const capacity: number[] = [];
  const area = (c: number) => capacity.push(c) - 1;
  const slotted = plan.bands.map((band): Slotted => {
    if (band.kind === "pictures") {
      const pictures = take(band.widths.length);
      const widths = band.widths.slice(0, pictures.length);
      const sum = widths.reduce((a, b) => a + b, 0) || 1;
      return { kind: "pictures", height: band.height, widths: widths.map((w) => w / sum), pictures, left: band.left, span: band.span };
    }
    if (band.kind === "split") {
      const pictures = take(band.pictures);
      return { ...band, pictures, text: area(pictures.length ? band.height * (1 - band.imageWidth) : band.height) };
    }
    if (band.kind === "columns") {
      return {
        kind: "columns",
        columns: band.columns.map((col) =>
          col.flatMap((item): SlottedItem[] => {
            if (item.kind === "text") return [{ kind: "text", text: area(item.weight * 0.5) }];
            const [picture] = take(1);
            return picture === undefined ? [] : [{ kind: "picture", height: item.height, picture }];
          }),
        ),
      };
    }
    return { kind: "text", columns: band.columns, text: area(band.weight) };
  });

  const totalCapacity = capacity.reduce((a, b) => a + b, 0) || 1;
  const totalWeight = blocks.reduce((n, b) => n + weightOf(b), 0);
  const assigned: B[][] = capacity.map(() => []);
  let at = capacity.findIndex((c) => c > 0);
  let filled = 0;
  for (const block of blocks) {
    // Move on once this area has its share - but never leave a block behind
    // without an area to go to.
    // An area takes a block while at least half of it falls within the
    // area's share.
    const w = weightOf(block);
    while (at >= 0 && filled > 0 && filled + w / 2 > (capacity[at] / totalCapacity) * totalWeight && capacity.slice(at + 1).some((c) => c > 0)) {
      at = capacity.findIndex((c, i) => i > at && c > 0);
      filled = 0;
    }
    assigned[Math.max(0, at)]?.push(block);
    filled += w;
  }

  const out: ZonedBand<B>[] = [];
  for (const band of slotted) {
    if (band.kind === "pictures") {
      if (band.pictures.length) out.push(band);
    } else if (band.kind === "split") {
      const text = assigned[band.text] ?? [];
      if (band.pictures.length) {
        out.push({ kind: "split", side: band.side, imageWidth: band.imageWidth, height: band.height, pictures: band.pictures, blocks: text });
      } else if (text.length) out.push({ kind: "text", columns: 1, blocks: text });
    } else if (band.kind === "columns") {
      const columns = band.columns.map((col) =>
        col.flatMap((item): ZonedItem<B>[] => {
          if (item.kind === "picture") return [item];
          const text = assigned[item.text] ?? [];
          return text.length ? [{ kind: "text", blocks: text }] : [];
        }),
      ) as [ZonedItem<B>[], ZonedItem<B>[]];
      if (columns.some((c) => c.length)) out.push({ kind: "columns", columns });
    } else {
      const text = assigned[band.text] ?? [];
      if (text.length) out.push({ kind: "text", columns: band.columns, blocks: text });
    }
  }
  return out;
}

// Every block of a laid-out band, in reading order.
export function zonedBlocks<B>(band: ZonedBand<B>): B[] {
  if (band.kind === "pictures") return [];
  if (band.kind === "columns") return band.columns.flat().flatMap((i) => (i.kind === "text" ? i.blocks : []));
  return band.blocks;
}

// Every picture index of a laid-out band, in reading order.
export function zonedPictures<B>(band: ZonedBand<B>): number[] {
  if (band.kind === "text") return [];
  if (band.kind === "columns") return band.columns.flat().flatMap((i) => (i.kind === "picture" ? [i.picture] : []));
  return band.pictures;
}

// Faz G3: the shape (width / height) of the slot each of the page's
// pictures lands in - main picture first, as layoutZones assigns them - so a
// picture is drawn for its frame instead of as a square cropped to a strip.
// The page is taken at the usual coursebook proportion (A4 0.71, 220×280
// 0.79); the size choice below is coarse enough for either.
const PAGE_ASPECT = 0.75;

export function pictureSlotAspects(plan: ZonePlan, pictureCount: number): number[] {
  const aspects: number[] = [];
  for (const band of layoutZones(plan, [], pictureCount, () => 0)) {
    if (band.kind === "pictures") {
      const rowWidth = band.span ?? 1;
      band.pictures.forEach((p, k) => (aspects[p] = (rowWidth * band.widths[k] * PAGE_ASPECT) / band.height));
    } else if (band.kind === "split") {
      const each = band.height / band.pictures.length;
      for (const p of band.pictures) aspects[p] = (band.imageWidth * PAGE_ASPECT) / each;
    } else if (band.kind === "columns") {
      for (const item of band.columns.flat()) if (item.kind === "picture") aspects[item.picture] = (0.48 * PAGE_ASPECT) / item.height;
    }
  }
  return aspects;
}

export type PictureShape = "landscape" | "portrait" | "square";

export function pictureShape(aspect: number | undefined): PictureShape {
  if (!aspect) return "landscape";
  if (aspect >= 1.25) return "landscape";
  if (aspect <= 0.8) return "portrait";
  return "square";
}

// Faz G3/KIYAS-11: how a picture should be drawn for its slot. A large slot
// on a coursebook page holds a full scene - colour and detail to the frame's
// edges - while a small one holds a single object (a vocabulary picture).
// Live run 2026-10-18: every picture came back as one object on white, so
// even big frames printed as a mostly blank page.
const SCENE_AREA = 0.08; // share of the page

export function pictureFraming(plan: ZonePlan, pictureCount: number): ("scene" | "object")[] {
  const out: ("scene" | "object")[] = [];
  for (const band of layoutZones(plan, [], pictureCount, () => 0)) {
    if (band.kind === "pictures") band.pictures.forEach((p, k) => (out[p] = (band.span ?? 1) * band.widths[k] * band.height >= SCENE_AREA ? "scene" : "object"));
    else if (band.kind === "split") for (const p of band.pictures) out[p] = (band.imageWidth * band.height) / band.pictures.length >= SCENE_AREA ? "scene" : "object";
    else if (band.kind === "columns") for (const i of band.columns.flat()) if (i.kind === "picture") out[i.picture] = 0.48 * i.height >= SCENE_AREA ? "scene" : "object";
  }
  return out;
}
