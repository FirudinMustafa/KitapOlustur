import sharp from "sharp";
import type { StudioImageSizeId } from "./model";
import { layoutPageType } from "./page-labels";

// Plan step 3 (2026-10-23): a "cards" page (a row or grid of similar object
// pictures, e.g. Super Minds p.3's six coloured pencils) gets ONE generated
// picture holding every card on a fixed grid, cut into the separate cards
// here - one paid call instead of N, and the cards share one art style
// because they are drawn together.

export const MAX_SHEET_CARDS = 12;

export type CardGrid = { cols: number; rows: number };

// Two rows as soon as one row gets long; a third only past ten cards.
export function cardSheetGrid(n: number): CardGrid {
  const count = Math.max(1, Math.min(MAX_SHEET_CARDS, Math.round(n)));
  if (count <= 3) return { cols: count, rows: 1 };
  if (count === 4) return { cols: 2, rows: 2 };
  if (count <= 10) return { cols: Math.ceil(count / 2), rows: 2 };
  return { cols: 4, rows: 3 };
}

const SIZE_ASPECTS: [StudioImageSizeId, number][] = [
  ["1536x1024", 1.5],
  ["1024x1024", 1],
  ["1024x1536", 1024 / 1536],
];

// The GPT Image size closest to the grid's shape (square cells).
export function cardSheetSize({ cols, rows }: CardGrid): StudioImageSizeId {
  const aspect = cols / rows;
  return SIZE_ASPECTS.reduce((best, cur) => (Math.abs(Math.log(cur[1] / aspect)) < Math.abs(Math.log(best[1] / aspect)) ? cur : best))[0];
}

export function cardSheetPrompt(items: string[], styleSuffix?: string): string {
  return [cardSheetItemsPrompt(items), cardSheetStyle(Math.min(items.length, MAX_SHEET_CARDS), styleSuffix)].join("\n\n");
}

// The two halves of cardSheetPrompt. The workflow sends the layout and style
// half as generateReviewedImage's styleSuffix, which a QA retry (rewriting
// the prompt) can never drop.
export function cardSheetItemsPrompt(items: string[]): string {
  const cards = items.slice(0, MAX_SHEET_CARDS).map((s) => s.trim().replace(/\s+/g, " ").replace(/[.\s]+$/, ""));
  const { cols, rows } = cardSheetGrid(cards.length);
  const rowLines = Array.from({ length: rows }, (_, r) => {
    const inRow = cards.slice(r * cols, (r + 1) * cols);
    if (!inRow.length) return null;
    const blanks = cols - inRow.length;
    return `Row ${r + 1}, left to right: ${inRow.map((c, i) => `(${r * cols + i + 1}) ${c}`).join("; ")}${blanks ? `; then ${blanks === 1 ? "one empty cell" : `${blanks} empty cells`}` : ""}.`;
  }).filter(Boolean);
  return [`A sheet of ${cards.length} separate picture cards for a children's coursebook.`, ...rowLines].join("\n");
}

export function cardSheetStyle(n: number, styleSuffix?: string): string {
  const { cols, rows } = cardSheetGrid(n);
  const empty = cols * rows - n;
  return [
    [
      `Layout: exactly ${n} separate objects arranged on an invisible grid of ${cols} columns and ${rows} row${rows > 1 ? "s" : ""} of equal cells, one object centred in each cell.`,
      `Each object is drawn whole, large and centred in its own cell, filling about 70% of the cell, with generous plain white space between neighbouring cells - no object touches or overlaps another or crosses into a neighbouring cell.`,
      empty ? `The ${empty === 1 ? "last cell stays" : `last ${empty} cells stay`} completely empty.` : "",
      `Plain pure white background everywhere (#FFFFFF), no scenery, no floor, no shadows on the background. No text, no letters, no numbers, no labels, no borders, no frames, no card outlines, no grid lines.`,
    ]
      .filter(Boolean)
      .join(" "),
    styleSuffix ? `${styleSuffix}\nAll cards in this one consistent style; keep the plain white background regardless of any composition note above.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Which of a page's pictures one sheet draws: slot 0 is the main picture,
// slot k the k-th extra picture. A "cards" page's cards are its extra
// pictures; with fewer than three of those the main picture joins them.
// Null when the page is no card page or has too few pictures for a sheet.
export function cardSheetSlots(page: { imagePrompt?: string; extraImagePrompts?: string[] }): { slot: number; prompt: string }[] | null {
  if (layoutPageType(page) !== "cards") return null;
  const extras = (page.extraImagePrompts ?? []).map((prompt, i) => ({ slot: i + 1, prompt: prompt.trim() }));
  if (extras.some((e) => !e.prompt)) return null;
  const slots = extras.length >= 3 ? extras : page.imagePrompt?.trim() ? [{ slot: 0, prompt: page.imagePrompt.trim() }, ...extras] : extras;
  return slots.length >= 3 && slots.length <= MAX_SHEET_CARDS ? slots : null;
}

// A cell this close to white everywhere holds no object.
const WHITE_THRESHOLD = 28;

// Cuts the sheet into its cells (row by row, first `count` cells) and trims
// each to its object, padded onto a white square so an object that drifted
// inside its cell comes out centred. Throws if a card's cell is empty - the
// caller then falls back to one generation per picture.
export async function sliceCardSheet(png: Buffer, cols: number, rows: number, count = cols * rows): Promise<Buffer[]> {
  const meta = await sharp(png).metadata();
  if (!meta.width || !meta.height) throw new Error("Card sheet has no size");
  const cellW = Math.floor(meta.width / cols);
  const cellH = Math.floor(meta.height / rows);
  // Leave the outermost 2% of each cell: slivers of a neighbour that crept
  // over the boundary would otherwise stretch the trimmed box.
  const insetX = Math.round(cellW * 0.02);
  const insetY = Math.round(cellH * 0.02);
  const cards: Buffer[] = [];
  for (let i = 0; i < Math.min(count, cols * rows); i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cell = await sharp(png)
      .extract({ left: col * cellW + insetX, top: row * cellH + insetY, width: cellW - 2 * insetX, height: cellH - 2 * insetY })
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer();
    cards.push(await trimToSquare(cell, i + 1));
  }
  return cards;
}

async function trimToSquare(cell: Buffer, card: number): Promise<Buffer> {
  // An all-white cell would come back from trim untouched, not fail.
  if ((await inkRatio(cell)) < 0.005) throw new Error(`Card ${card} of the sheet is empty`);
  const { data, info } = await sharp(cell).trim({ background: "#ffffff", threshold: WHITE_THRESHOLD }).png().toBuffer({ resolveWithObject: true });
  const side = Math.round(Math.max(info.width, info.height) * 1.12);
  const left = Math.floor((side - info.width) / 2);
  const top = Math.floor((side - info.height) / 2);
  return sharp(data)
    .extend({ left, right: side - info.width - left, top, bottom: side - info.height - top, background: "#ffffff" })
    .png()
    .toBuffer();
}

// Share of pixels that are clearly not white.
async function inkRatio(cell: Buffer): Promise<number> {
  const { data, info } = await sharp(cell).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let ink = 0;
  for (let p = 0; p < data.length; p += info.channels) {
    if (Math.min(data[p], data[p + 1], data[p + 2]) < 255 - WHITE_THRESHOLD) ink++;
  }
  return ink / (info.width * info.height);
}
