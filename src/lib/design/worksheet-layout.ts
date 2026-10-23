import type { ContentBlock } from "@/lib/ai/schemas";
import { GRID_CELL, MATCH_ROW, activityHeight, isEmoji, splitEmoji } from "@/lib/activities";
import { buildCrossword } from "@/lib/puzzles";
import { DENSE_LINE, estimateBlockHeight, itemColumns } from "@/lib/design/layouts";
import { itemText } from "@/lib/item-text";
import { TYPE_GAP, cardColumns, rubricOnly, typedRoom, type TypedMetrics } from "@/lib/design/type-layout";

// A workbook page set like an activity book's (Super Minds / Kid's Box
// activity books): each exercise in its own frame, a picture-labelling
// exercise as a grid of big picture tiles with a write line under each,
// the page filled. The workbook is a complementary book - it has no source
// page, so no zone plan or page type - and printed as cards in plain flow
// it left the last lines of an exercise alone on a page and the rest of
// that page empty, with picture tiles too small to label (KIYAS-14).
//
// A page's exercises that do not fit one sheet go on two (or more), split
// between whole exercises and balanced, so each sheet is a designed page
// instead of a page and a tail. What a sheet has left over goes to its
// picture tiles first, then the page's picture, then larger text, then the
// space between the frames. Pure TS, shared by the PDF (pdf/worksheet.tsx)
// and tests.

export const FRAME_PAD = 10;
const FRAME_BORDER = 1.5;
// A picture tile's write line under it.
export const TILE_LINE_H = 24;
export const TILE_GAP = 10;
// The smallest picture tile worth a big grid (PictureLabelGrid draws 54pt),
// and the largest: a tile is at most this share of its width, and never
// taller than this (pt).
const MIN_TILE = 64;
const TILE_ASPECT = 0.85;
const MAX_TILE = 160;
// A picture-labelling exercise of at least this many pictures prints as big tiles.
const GRID_MIN = 4;
// A picture-matching row grows from MATCH_ROW up to this.
const MAX_MATCH_ROW = 78;
// The page's picture: at least this tall where it goes, at most this share of the page.
const MIN_MAIN = 110;
const MAX_MAIN_SHARE = 0.36;
// Beside an exercise: this share of the frame's width, next to an
// exercise at least this tall (frame included).
const SIDE_SHARE = 0.36;
export const SIDE_GAP = 12;
const MIN_SIDE_H = 110;
// What a frame reaches below its last measured line (see worksheetLayout).
const SLACK_FRAME = 20;
// The coursebook estimate (estimateBlockHeight, frameless) measured 10-25%
// over these exercises printed in frames (KIYAS-14 Workbook); a page it
// gets wrong either way is measured and set again (renderBookFitted).
const EST_SCALE = 0.88;
const EMOJI_MAX = 2;
// A crossword in a frame: cells from MIN up to MAX pt, the grid at most
// this share of the width; CrosswordView's gap and its Across/Down labels.
const MIN_CROSS_CELL = 20;
const MAX_CROSS_CELL = 30;
const CROSS_SHARE = 0.55;
export const CROSS_GAP = 12;
const CROSS_LABEL = 17;
// The margin a dense exercise (BlockCard) ends in - inside a frame its padding takes the place.
export const DENSE_TAIL = 8;
// Text grows in steps up to this factor while the sheet has room.
const MAX_TEXT_GROW = 1.2;
const TEXT_STEP = 0.05;
const MAX_GAP = 26;

export type WorksheetItem = {
  block: ContentBlock;
  /** A picture-labelling exercise as big tiles. */
  grid?: { columns: number; tileWidth: number; faceHeight: number };
  /** A picture-matching exercise's row height. */
  matchRow?: number;
  /** A crossword's cell size (pt) - a larger grid, its clues beside it. */
  crossCell?: number;
  /** Size (pt) of the emoji pictures in its items (counting rows). */
  emoji?: number;
  /** Width of the page's picture beside the exercise, inside its frame, and its height (the exercise's, estimated). */
  side?: number;
  sideHeight?: number;
};

export type WorksheetSheet = {
  items: WorksheetItem[];
  /** Height of the page's picture at the top of this sheet (0 = not here). */
  mainHeight: number;
  /** Space between the frames. */
  gap: number;
  /** Body text size on this sheet (the theme's, or grown into the sheet's room). */
  bodySize: number;
};

export type WorksheetLayout = { type: "worksheet"; sheets: WorksheetSheet[] };

type Options = {
  isUnitFirstPage?: boolean;
  /** The page's picture is available. */
  hasMain?: boolean;
  /** Empty height a render of sheet k left at its foot (renderBookFitted). */
  slack?: (sheet: number) => number | undefined;
  /** The page ran over: sizes come from a room held back (typedRoom). */
  compact?: boolean;
  /** It ran over set compact too: its exercises go on two sheets or more. */
  split?: boolean;
};

const frameWidth = (m: TypedMetrics) => m.width - 88;
const innerWidth = (m: TypedMetrics) => frameWidth(m) - 2 * (FRAME_PAD + FRAME_BORDER);

// An exercise that prints as a grid of big picture tiles. A picture the
// renderer has no icon for prints as its description on the tile, as
// PictureLabelGrid does.
export function isTileGrid(b: ContentBlock): boolean {
  const pictures = b.activity?.type === "picture_label" ? (b.activity.pictures ?? []) : [];
  return Math.min(pictures.length, b.items?.length ?? 0) >= GRID_MIN;
}

function gridShape(n: number, columns: number, width: number, budget: number): { columns: number; tileWidth: number; faceHeight: number } {
  const rows = Math.ceil(n / columns);
  const tileWidth = (width - TILE_GAP * (columns - 1)) / columns;
  const fit = (budget - rows * TILE_LINE_H - (rows - 1) * TILE_GAP) / rows;
  return { columns, tileWidth, faceHeight: Math.floor(Math.min(fit, tileWidth * TILE_ASPECT, MAX_TILE)) };
}

const gridHeight = (n: number, g: { columns: number; faceHeight: number }) => {
  const rows = Math.ceil(n / g.columns);
  return rows * (g.faceHeight + TILE_LINE_H) + (rows - 1) * TILE_GAP;
};

// The tile grid that makes the biggest tiles in `budget` pt of height:
// fewer columns give wider tiles and more rows.
function bestGrid(n: number, width: number, budget: number) {
  let best = gridShape(n, cardColumns(n), width, budget);
  for (let c = 2; c <= Math.min(5, n); c++) {
    const g = gridShape(n, c, width, budget);
    if (g.faceHeight > best.faceHeight || (g.faceHeight === best.faceHeight && c > best.columns)) best = g;
  }
  return best;
}

// A crossword's cell: at least `min` (GRID_CELL is the coursebook's), the
// grid at most CROSS_SHARE of the frame's width, its clues beside it.
function crossCell(cols: number, width: number, min: number): number {
  return Math.max(GRID_CELL, Math.min(min, Math.floor((width * CROSS_SHARE) / Math.max(1, cols))));
}

// Items side by side as ItemList sets them on a dense page.
const emojiColumns = (b: ContentBlock) => (b.activity?.type === "write_lines" ? 1 : itemColumns(b.items));

// Counting rows ("🐟🐟🐟 = ___") with their pictures at body size were too
// small to count (KIYAS-14): as big as the longest row fits its column, up
// to EMOJI_MAX body sizes.
function emojiSize(b: ContentBlock, width: number, size: number): number | undefined {
  const rows = (b.items ?? []).map(itemText).filter(isEmoji);
  if (!rows.length || b.activity?.type === "picture_label") return undefined;
  const column = width / emojiColumns(b) - 24;
  const fit = Math.min(
    ...rows.map((row) => {
      const parts = splitEmoji(row);
      const pictures = parts.filter((p) => p.emoji).length;
      const text = parts.reduce((n, p) => n + (p.text?.length ?? 0), 0) * size * 0.55;
      return (column - text) / Math.max(1, pictures) - 1;
    }),
  );
  const pt = Math.floor(Math.min(size * EMOJI_MAX, fit));
  return pt > size * 1.2 ? pt : undefined;
}

// One framed exercise's height at its smallest (tiles at MIN_TILE, matching rows at MATCH_ROW).
function itemHeight(item: WorksheetItem, m: TypedMetrics, size: number): number {
  const b = item.block;
  const w = innerWidth(m);
  const frame = 2 * (FRAME_PAD + FRAME_BORDER);
  if (item.grid) {
    const head = estimateBlockHeight(rubricOnly(b), w, size, true);
    const bank = activityHeight({ ...b, items: [] }, w, size).extra;
    return frame + head + bank + gridHeight(b.items!.length, item.grid) + 4;
  }
  if (item.crossCell) {
    const cw = buildCrossword(b.answerKey ?? []);
    const head = estimateBlockHeight(rubricOnly(b), w, size, true);
    const clueWidth = w - cw.cols * item.crossCell - CROSS_GAP;
    const perLine = Math.max(8, clueWidth / (size * 0.5));
    const clues = (b.items ?? []).reduce((n, i) => n + Math.ceil((itemText(i).length + 4) / perLine) * size * DENSE_LINE + 2, 0) + 2 * CROSS_LABEL;
    return frame + head + Math.max(cw.rows * item.crossCell, clues) + 4;
  }
  let h = estimateBlockHeight(b, item.side ? w - item.side - SIDE_GAP : w, size, true) * EST_SCALE;
  if (item.emoji) {
    const counted = (b.items ?? []).filter((i) => isEmoji(itemText(i))).length;
    h += Math.ceil(counted / emojiColumns(b)) * Math.max(0, item.emoji + 2 - size * DENSE_LINE);
  }
  if (item.matchRow) return frame + h + (item.matchRow - MATCH_ROW) * (b.items?.length ?? 0);
  return frame + h;
}

const sheetHeight = (items: WorksheetItem[], m: TypedMetrics, size: number, gap = TYPE_GAP) =>
  items.reduce((n, it) => n + itemHeight(it, m, size), 0) + gap * Math.max(0, items.length - 1);

// The fewest sheets (at least `min`) the blocks fit on in order, split
// between whole exercises; of those splits, the one whose fullest sheet is
// emptiest. Past what fits, `min` sheets balanced.
function splitSheets(items: WorksheetItem[], room: (k: number) => number, m: TypedMetrics, min: number): WorksheetItem[][] {
  const n = items.length;
  for (let k = Math.min(min, n); k <= n; k++) {
    const groups = balancedSplit(items, k, room, m, true);
    if (groups) return groups;
  }
  return balancedSplit(items, Math.min(min, n), room, m, false)!;
}

// Every way to cut the blocks into k runs (a page holds a handful).
function balancedSplit(items: WorksheetItem[], k: number, room: (k: number) => number, m: TypedMetrics, mustFit: boolean): WorksheetItem[][] | null {
  let best: WorksheetItem[][] | null = null;
  let bestWorst = Infinity;
  const walk = (from: number, groups: WorksheetItem[][]) => {
    if (groups.length === k - 1) {
      const all = [...groups, items.slice(from)];
      const fill = all.map((g, i) => sheetHeight(g, m, m.bodySize) / room(i));
      if (all.some((g) => !g.length) || (mustFit && fill.some((f) => f > 1))) return;
      const worst = Math.max(...fill);
      if (worst < bestWorst) [best, bestWorst] = [all, worst];
      return;
    }
    for (let to = from + 1; to < items.length; to++) walk(to, [...groups, items.slice(from, to)]);
  };
  walk(0, []);
  return best;
}

export function worksheetLayout(
  page: { blocks: ContentBlock[]; glossary?: unknown[] },
  m: TypedMetrics,
  { isUnitFirstPage = false, hasMain = false, slack, compact = false, split = false }: Options = {},
): WorksheetLayout | null {
  if (!page.blocks.length || page.glossary?.length || page.blocks.some((b) => b.layout)) return null;
  if (split && page.blocks.length < 2) return null;
  const width = innerWidth(m);
  const items: WorksheetItem[] = page.blocks.map((block) => {
    if (isTileGrid(block)) {
      const n = block.items!.length;
      const columns = cardColumns(n);
      return { block, grid: { columns, tileWidth: (width - TILE_GAP * (columns - 1)) / columns, faceHeight: MIN_TILE } };
    }
    if (block.activity?.type === "picture_match" && (block.activity.pictures?.length ?? 0) >= GRID_MIN) return { block, matchRow: MATCH_ROW };
    if (block.activity?.type === "crossword") {
      const cols = buildCrossword(block.answerKey ?? []).cols;
      if (cols) return { block, crossCell: crossCell(cols, width, MIN_CROSS_CELL) };
    }
    const emoji = emojiSize(block, width, m.bodySize);
    return emoji ? { block, emoji } : { block };
  });
  // One sheet until a render measured the page running over even set
  // compact (the estimate runs high or low by a fifth on these exercises,
  // and a split made on it alone printed pages that fit on one). The split
  // is made on the plain room, so a sheet's measured slack stays its own.
  const plainRoom = (k: number) => typedRoom(m, isUnitFirstPage && k === 0);
  const groups = split ? splitSheets(items, plainRoom, m, 2) : [items];
  // Slack is measured under the last line of text or picture; a frame's
  // padding and border and the write lines under picture tiles reach
  // below it.
  const rooms = groups.map((_, k) => typedRoom(m, isUnitFirstPage && k === 0, Math.max(0, (slack?.(k) ?? 0) - SLACK_FRAME), compact));
  // The page's picture goes on top of the first sheet with room for it, or
  // else beside an exercise of short lines (the story picture next to its
  // tick-or-cross sentences), where it takes little extra height.
  const mainAt = hasMain ? rooms.findIndex((r, k) => r - sheetHeight(groups[k], m, m.bodySize) - TYPE_GAP >= MIN_MAIN) : -1;
  if (hasMain && mainAt < 0) placeBeside(groups, rooms, m);
  const sheets = groups.map((group, k) => fillSheet(group, rooms[k], m, k === mainAt, compact));
  return { type: "worksheet", sheets };
}

// Exercises a picture can stand beside: lines of text, not a grid or a
// puzzle that needs the frame's width.
const WIDE_ACTIVITIES = new Set(["wordsearch", "crossword", "picture_label", "picture_match", "draw_box"]);

function placeBeside(groups: WorksheetItem[][], rooms: number[], m: TypedMetrics): void {
  const side = Math.floor(innerWidth(m) * SIDE_SHARE);
  let best: { k: number; i: number; h: number } | null = null;
  groups.forEach((group, k) => {
    const free = rooms[k] - sheetHeight(group, m, m.bodySize);
    group.forEach((it, i) => {
      const b = it.block;
      if (it.grid || it.matchRow || b.table || b.dialogue?.length || b.callout || WIDE_ACTIVITIES.has(b.activity?.type ?? "")) return;
      const beside = { ...it, side };
      const h = itemHeight(beside, m, m.bodySize);
      if (h - itemHeight(it, m, m.bodySize) > free || h < MIN_SIDE_H) return;
      if (!best || h > best.h) best = { k, i, h };
    });
  });
  if (!best) return;
  const { k, i } = best;
  groups[k][i] = { ...groups[k][i], side };
}

// What a sheet has left goes to its picture tiles, the page's picture,
// larger text and the gaps between frames, in that order.
function fillSheet(group: WorksheetItem[], room: number, m: TypedMetrics, main: boolean, compact: boolean): WorksheetSheet {
  const width = innerWidth(m);
  let items = group;
  let free = room - sheetHeight(items, m, m.bodySize) - (main ? MIN_MAIN + TYPE_GAP : 0);
  const grids = items.filter((it) => it.grid).length;
  if (grids && free > 0) {
    const share = free / grids;
    items = items.map((it) => {
      if (!it.grid) return it;
      const n = it.block.items!.length;
      const now = gridHeight(n, it.grid);
      const grid = bestGrid(n, width, now + share);
      if (grid.faceHeight <= it.grid.faceHeight) return it;
      free -= gridHeight(n, grid) - now;
      return { ...it, grid };
    });
  }
  // A crossword's cells grow up to MAX_CROSS_CELL (as wide as its half of the frame allows).
  for (const [k, it] of items.entries()) {
    if (!it.crossCell || free <= 0) continue;
    const now = itemHeight(it, m, m.bodySize);
    let best = it;
    for (let c = it.crossCell + 1; c <= crossCell(buildCrossword(it.block.answerKey ?? []).cols, width, MAX_CROSS_CELL); c++) {
      const next = { ...it, crossCell: c };
      if (itemHeight(next, m, m.bodySize) - now > free) break;
      best = next;
    }
    free -= itemHeight(best, m, m.bodySize) - now;
    items = items.map((x, j) => (j === k ? best : x));
  }
  const matches = items.filter((it) => it.matchRow);
  if (matches.length && free > 0) {
    const rows = matches.reduce((n, it) => n + (it.block.items?.length ?? 0), 0);
    const grow = Math.min(MAX_MATCH_ROW - MATCH_ROW, Math.floor(free / 2 / rows));
    if (grow > 0) {
      items = items.map((it) => (it.matchRow ? { ...it, matchRow: MATCH_ROW + grow } : it));
      free -= grow * rows;
    }
  }
  let mainHeight = 0;
  if (main) {
    const extra = Math.max(0, Math.min(free, m.height * MAX_MAIN_SHARE - MIN_MAIN));
    mainHeight = Math.floor(MIN_MAIN + extra);
    free -= extra;
  }
  let bodySize = m.bodySize;
  if (!compact) {
    const fixed = room - (main ? mainHeight + TYPE_GAP : 0);
    for (let f = 1 + TEXT_STEP; f <= MAX_TEXT_GROW + 1e-9; f += TEXT_STEP) {
      if (sheetHeight(items, m, m.bodySize * f) > fixed) break;
      bodySize = m.bodySize * f;
    }
    free = fixed - sheetHeight(items, m, bodySize);
  }
  const gap = compact ? TYPE_GAP * 0.6 : TYPE_GAP + Math.max(0, Math.min(MAX_GAP - TYPE_GAP, free / Math.max(1, items.length)));
  // A picture beside an exercise gets the exercise's height: left to the
  // row, it took the picture's own and the page's frames overprinted.
  const frame = 2 * (FRAME_PAD + FRAME_BORDER);
  items = items.map((it) => (it.side ? { ...it, sideHeight: Math.floor(Math.max(MIN_SIDE_H - frame, itemHeight(it, m, bodySize) - frame - DENSE_TAIL)) } : it));
  return { items, mainHeight, gap: Math.floor(gap), bodySize: Math.round(bodySize * 100) / 100 };
}
