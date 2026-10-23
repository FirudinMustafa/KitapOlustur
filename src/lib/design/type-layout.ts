import type { ContentBlock } from "@/lib/ai/schemas";
import { COLOR_HEX, isEmoji, splitEmoji } from "@/lib/activities";
import { estimateBlockHeight, isExerciseBlock } from "@/lib/design/layouts";
import type { PageLayoutType } from "@/lib/design/page-types";
import { itemText } from "@/lib/item-text";

// "Önce sayfa tasarımı": how a scene, card or panel page (page-types.ts) is
// set - which block leads it, what each card shows, how big the grid is -
// or null when the page's content does not suit its type's template (the
// page then keeps the zone layout, so a page never runs over for it).
// Pure TS, shared by the PDF templates (pdf/type-templates.tsx) and tests.

export type TypedMetrics = { width: number; height: number; bodySize: number };

// Heights outside a flowing page's content (page-geometry PAGE_PADDING,
// BookDocument's running header, templates' UnitHeading).
const PAD_TOP = 44;
const PAD_BOTTOM = 56;
const PAD_X = 44;
const RUNNING_HEADER = 22;
const UNIT_HEADING = 52;
export const TYPE_GAP = 10;

// What a card shows above its word: its own picture (the page's extra
// picture in the card's place), a number tile, a colour pencil, the item's
// emoji - or only its word, large.
export type CardFace = { kind: "picture"; src: string } | { kind: "number"; n: string } | { kind: "color"; hex: string } | { kind: "emoji"; emoji: string } | { kind: "word" };

export type Card = { word: string; face: CardFace };

export type TypedLayout =
  | {
      type: "scene";
      lead: ContentBlock;
      /** The lead exercise's items as chips over the picture's foot (or labels, see LabelOverlay). */
      chips: string[];
      /** The page's other blocks, on a panel above the footer. */
      rest: ContentBlock[];
      restHeight: number;
    }
  | {
      type: "cards";
      before: ContentBlock[];
      lead: ContentBlock;
      cards: Card[];
      columns: number;
      cardWidth: number;
      /** Height of the card's picture area (the word goes under it). */
      faceHeight: number;
      rest: ContentBlock[];
      /** The page's main picture under the grid, when there is room for it. */
      mainHeight: number;
    }
  | {
      type: "panels";
      before: ContentBlock[];
      lead: ContentBlock;
      pictures: string[];
      lines: string[];
      columns: number;
      panelWidth: number;
      panelHeight: number;
      rest: ContentBlock[];
    };

export type TypedPictures = {
  /** The page's main picture (imagePrompt). */
  main?: string;
  /** Extra picture k+1 (extraImagePrompts[k]) at index k - undefined where it was not generated. */
  extras: (string | undefined)[];
  /** The prompts the extras were drawn from, same order. */
  prompts: string[];
};

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

// A card's item is a word or two ("red", "3", "pencil case").
const CARD_ITEM_WORDS = 3;
const CARD_ITEM_CHARS = 24;
const MIN_CARDS = 3;
const MAX_CARDS = 10; // one extra picture per card (MAX_TYPE_PICTURES)
// At least this share of the cards needs a face - a grid of bare words is
// not a card page.
const MIN_FACES = 0.75;
// A card picture smaller than this (pt) reads as an icon, not a card.
const MIN_FACE = 48;
export const CARD_WORD_H = 18;
// The main picture under a card grid: only when it can be at least this
// tall.
const MIN_MAIN = 110;
// Scene: the other blocks' panel takes at most this share of the page.
const SCENE_REST_SHARE = 0.3;
const SCENE_MAX_CHIPS = 10;
const LISTENING_HEADING = /\b(listen|sing|chant|watch)\b/i;
// Panels: at least this many panel pictures, and a speech line's room.
const MIN_PANELS = 4;
// A typed page that ran over is set again with this share of the page
// height held back (KIYAS-14: six story panels ran a few lines over, and
// the page lost its panel grid for a list of small pictures).
const COMPACT_TRIM = 0.1;
const MAX_PANELS = 9;
export const PANEL_LINE_H = 22;
const PANEL_MAX_ASPECT = 1.8;
const PANEL_MIN_ASPECT = 0.9;

// KIYAS-14: a story page's "Friends are kind" box took the height its six
// panels needed, the panel grid did not fit, and the page fell back to a
// list with small pictures that then ran over. A type template that does
// not fit is tried once more without the page's callout boxes - the source
// prints its value line in the footer, not as a box on the page.
export function typedLayout(...args: Parameters<typeof typedLayoutOnce>): TypedLayout | null {
  const [type, page, ...rest] = args;
  const first = typedLayoutOnce(type, page, ...rest);
  if (first || !page.blocks.some((b) => b.callout)) return first;
  return typedLayoutOnce(type, { ...page, blocks: page.blocks.filter((b) => !b.callout) }, ...rest);
}

function typedLayoutOnce(
  type: PageLayoutType,
  page: { blocks: ContentBlock[]; glossary?: unknown[] },
  pictures: TypedPictures,
  m: TypedMetrics,
  { isUnitFirstPage = false, emojiSrc, slack = 0, compact = false }: { isUnitFirstPage?: boolean; emojiSrc?: Record<string, string>; slack?: number; compact?: boolean } = {},
): TypedLayout | null {
  if (type === "mixed" || !page.blocks.length || page.glossary?.length) return null;
  const contentWidth = m.width - 2 * PAD_X;
  const est = (bs: ContentBlock[], width = contentWidth) => bs.reduce((n, b) => n + estimateBlockHeight(b, width, m.bodySize, true), 0);
  // `slack`: empty height a render of this page left at its foot (renderBookFitted) - the estimate was that much too high.
  const room = m.height - PAD_TOP - PAD_BOTTOM - RUNNING_HEADER - (isUnitFirstPage ? UNIT_HEADING : 0) + slack - (compact ? m.height * COMPACT_TRIM : 0);

  if (type === "scene") {
    if (!pictures.main) return null;
    // The rubric on the pill: the first exercise, else the page's listening task (a song with no items).
    const lead = page.blocks.find(isExerciseBlock) ?? page.blocks.find((b) => LISTENING_HEADING.test(b.heading ?? "")) ?? page.blocks[0];
    const items = lead.items ?? [];
    const chippable = items.length > 0 && items.length <= SCENE_MAX_CHIPS && items.every((i) => words(itemText(i)) <= CARD_ITEM_WORDS && itemText(i).length <= CARD_ITEM_CHARS) && !lead.activity;
    // The lead's rubric goes on the pill; items that are not labels
    // (sentences, a matching list) go on the panel with the other blocks.
    const others = page.blocks.filter((b) => b !== lead);
    const rest = chippable || !items.length ? others : [{ ...lead, heading: "", body: "" }, ...others];
    const restHeight = rest.length ? est(rest, contentWidth - 20) + 20 : 0;
    if (restHeight > m.height * SCENE_REST_SHARE) return null;
    return { type, lead, chips: chippable ? items.map(itemText) : [], rest, restHeight };
  }

  if (type === "cards") {
    const leadAt = page.blocks.findIndex(
      (b) =>
        isExerciseBlock(b) &&
        !b.activity &&
        (b.items?.length ?? 0) >= MIN_CARDS &&
        (b.items?.length ?? 0) <= MAX_CARDS &&
        b.items!.every((i) => words(itemText(i)) <= CARD_ITEM_WORDS && itemText(i).length <= CARD_ITEM_CHARS),
    );
    if (leadAt < 0) return null;
    const lead = page.blocks[leadAt];
    const cards = lead.items!.map((raw, k): Card => {
      const word = itemText(raw).trim().replace(/[.!]$/, "");
      return { word, face: cardFace(word, pictures.extras[k], pictures.prompts[k], emojiSrc) };
    });
    if (cards.filter((c) => c.face.kind !== "word").length < cards.length * MIN_FACES) return null;
    const before = page.blocks.slice(0, leadAt);
    const rest = page.blocks.slice(leadAt + 1);
    const columns = cardColumns(cards.length);
    const rows = Math.ceil(cards.length / columns);
    const cardWidth = (contentWidth - TYPE_GAP * (columns - 1)) / columns;
    const text = est(before) + est([rubricOnly(lead)]) + est(rest) + TYPE_GAP * 2;
    const free = room - text;
    // A card is at most as tall as it is wide (plus its word); the room
    // left under full-size cards takes the page's main picture.
    const tallest = rows * (cardWidth + CARD_WORD_H) + TYPE_GAP * (rows - 1);
    const spare = free - tallest - TYPE_GAP;
    const mainHeight = pictures.main && spare >= MIN_MAIN ? spare : 0;
    const grid = Math.min(free, tallest);
    const faceHeight = Math.floor((grid - TYPE_GAP * (rows - 1)) / rows - CARD_WORD_H);
    if (faceHeight < MIN_FACE) return null;
    return { type, before, lead, cards, columns, cardWidth, faceHeight, rest, mainHeight: Math.floor(mainHeight) };
  }

  // Panels: the main picture and the extras, in order, up to the first gap.
  const panelPictures: string[] = [];
  for (const src of [pictures.main, ...pictures.extras]) {
    if (!src) break;
    panelPictures.push(src);
  }
  if (panelPictures.length < MIN_PANELS) return null;
  const pics = panelPictures.slice(0, MAX_PANELS);
  const leadAt = Math.max(0, page.blocks.findIndex((b) => !!b.items?.length || !!b.dialogue?.length));
  const lead = page.blocks[leadAt];
  const lines = (lead.items?.length ? lead.items.map(itemText) : (lead.dialogue ?? []).map((d) => `${d.speaker}: ${d.line}`)).slice(0, pics.length);
  const before = page.blocks.slice(0, leadAt);
  const rest = page.blocks.slice(leadAt + 1);
  const columns = pics.length > 6 ? 3 : 2;
  const rows = Math.ceil(pics.length / columns);
  const panelWidth = (contentWidth - TYPE_GAP * (columns - 1)) / columns;
  const lineH = lines.length ? PANEL_LINE_H : 0;
  const text = est(before) + est([rubricOnly(lead)]) + est(rest) + TYPE_GAP * 2;
  const perRow = (room - text - TYPE_GAP * (rows - 1)) / rows - lineH;
  const panelHeight = Math.floor(Math.min(perRow, panelWidth / PANEL_MIN_ASPECT));
  if (panelHeight < panelWidth / PANEL_MAX_ASPECT) return null;
  return { type: "panels", before, lead, pictures: pics, lines, columns, panelWidth, panelHeight, rest };
}

// Card grids as the source sets them: 3 across for 5-6 cards, 4 for 7-8,
// 5 for 9-10 (two even rows), one row up to 4.
// The lead exercise without its items - they are on the cards / panels.
export const rubricOnly = (b: ContentBlock): ContentBlock => ({ ...b, items: undefined, answerKey: undefined, dialogue: undefined, interactive: undefined, activity: undefined });

export function cardColumns(n: number): number {
  if (n <= 4) return n;
  if (n <= 6) return 3;
  if (n <= 8) return 4;
  if (n <= 10) return 5;
  return 4;
}

// A card's picture is used when its prompt names the card's word: the
// stored pages of older runs have extra pictures that are not one object
// per card (a strip of three flashcards), and a card under the wrong
// picture is worse than a number tile.
export function cardFace(word: string, src: string | undefined, prompt: string | undefined, emojiSrc?: Record<string, string>): CardFace {
  const w = word.toLowerCase();
  if (/^\d{1,2}$/.test(w)) return { kind: "number", n: w };
  if (src && (!prompt || mentions(prompt, w))) return { kind: "picture", src };
  if (w in COLOR_HEX) return { kind: "color", hex: COLOR_HEX[w] };
  if (isEmoji(word)) {
    const emoji = splitEmoji(word).find((p) => p.emoji)?.emoji;
    if (emoji && emojiSrc?.[emoji]) return { kind: "emoji", emoji };
  }
  return { kind: "word" };
}

function mentions(prompt: string, word: string): boolean {
  const text = prompt.toLowerCase();
  const stem = word.replace(/(es|s)$/, "");
  return text.includes(word) || (stem.length >= 3 && text.includes(stem));
}
