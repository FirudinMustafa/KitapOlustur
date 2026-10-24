import { diagramHeight, type Diagram } from "@/lib/diagrams";
import { activityHeight, tileKind, type Activity } from "@/lib/activities";
import { PAGE_ASPECT, layoutZones, shapeAspect, type ZonePlan, type ZonedBand } from "@/lib/design/zones";
import { artefactTitle, letterParts, quizParts, resolveTextStyle, splitArtefact, type TextStyle } from "@/lib/text-style";
// Faz 1 "Tasarım sistemi": named page-layout templates. The writer model
// picks one per page (generatedPageSchema.layoutTemplate) and every renderer
// (BookDocument.tsx for PDF, PageContent.tsx for the web reader/Dizilim)
// draws that page with the same arrangement. Pure TS, no react-pdf/Node
// imports - safe to import from client components.
//
// Templates describe an arrangement, never pixel coordinates (the model is
// bad at geometry, and coordinates would tie content to one trim size). The
// renderer decides the actual sizes from the page size.

export const LAYOUT_TEMPLATE_IDS = [
  "unit-opener-hero",
  "two-column",
  "image-left-text-right",
  "dialogue-strip",
  "exercise-grid",
  "vocab-cards",
  "reading-with-sidebar",
  "review-checklist",
  "full-bleed-illustration",
] as const;
export type LayoutTemplateId = (typeof LAYOUT_TEMPLATE_IDS)[number];

// What a page actually renders with: a template, or "standard" (the original
// single-column flow - used for legacy pages and whenever a template's
// requirements aren't met, see resolvePageTemplate).
// "source-zones" (Faz B2) lays the page out like its source page
// (page.zonePlan, see zones.ts). Never chosen by the writer.
export type ResolvedTemplate = LayoutTemplateId | "standard" | "source-zones";
export type DesignedTemplate = Exclude<ResolvedTemplate, "standard">;

type TemplateSpec = {
  label: string;
  /** One-line guidance for the writer prompt. */
  whenToUse: string;
  needsImage: boolean;
};

export const LAYOUT_TEMPLATES: Record<LayoutTemplateId, TemplateSpec> = {
  "unit-opener-hero": {
    label: "Ünite açılışı",
    whenToUse:
      "The first page of a unit: a large hero illustration across the top, the unit title, and a short warm-up/lead-in (1-3 short blocks). Must have imagePrompt.",
    needsImage: true,
  },
  "two-column": {
    label: "İki sütun",
    whenToUse: "General content with 2-6 short, parallel blocks (e.g. grammar explanation + examples). The safe default.",
    needsImage: false,
  },
  "image-left-text-right": {
    label: "Görsel solda",
    whenToUse: "A page built around one picture the text talks about (describe the picture, a short reading about a scene). Must have imagePrompt.",
    needsImage: true,
  },
  "dialogue-strip": {
    label: "Diyalog",
    whenToUse:
      "A conversation between named characters. Put the conversation in a block's \"dialogue\" field (speaker + line per turn, max ~8 turns); it prints as speech bubbles.",
    needsImage: false,
  },
  "exercise-grid": {
    label: "Alıştırma kartları",
    whenToUse: "A page of 2-6 separate short exercises (each a practice/assessment block with items). Each prints as its own numbered card.",
    needsImage: false,
  },
  "vocab-cards": {
    label: "Kelime kartları",
    whenToUse: "Vocabulary presentation: the page's glossary prints as a grid of word cards, with 1-2 short blocks of practice.",
    needsImage: false,
  },
  "reading-with-sidebar": {
    label: "Okuma + yan kutu",
    whenToUse:
      "A reading text (narrative/explanation) with a side column for callout blocks (tip / did_you_know / remember) and short comprehension questions.",
    needsImage: false,
  },
  "review-checklist": {
    label: "Tekrar / öz değerlendirme",
    whenToUse: "End-of-unit review or self-assessment: a \"reference\" block whose items are \"I can...\" statements (printed with tick boxes), plus short recap exercises.",
    needsImage: false,
  },
  "full-bleed-illustration": {
    label: "Tam sayfa illüstrasyon",
    whenToUse: "Story/picture-book pages: the illustration fills the page and a short text (max ~350 characters) sits on it. Must have imagePrompt.",
    needsImage: true,
  },
};

type BlockLike = {
  kind: string;
  heading: string;
  body: string;
  items?: string[];
  interactive?:
    | { type: "multiple_choice"; options: string[] }
    | { type: "fill_blank"; template: string }
    | { type: "matching"; pairs: unknown[] };
  dialogue?: { speaker: string; line: string }[];
  table?: { headers: string[]; rows: string[][] };
  callout?: string;
  textStyle?: TextStyle;
  layout?: unknown;
  activity?: Activity;
  diagram?: Diagram;
  /** Lesson furniture: set only where a section head prints before the block (withSectionHeads). */
  section?: string;
};

type PageLike = {
  layoutTemplate?: LayoutTemplateId | null;
  blocks: BlockLike[];
  glossary?: unknown[];
  imageLayout?: unknown;
  zonePlan?: ZonePlan | null;
};

// A self-assessment list ("I can introduce myself.") rather than an
// exercise - printed with tick boxes and exempt from the items/answerKey
// pairing rule (see validateUnitStructure).
const CAN_DO = /^\s*(I can|I know|I understand|I am able|I'm able)\b/i;

export function isChecklistBlock(b: { kind: string; items?: string[] }): boolean {
  if (!b.items?.length) return false;
  return b.kind === "reference" || b.items.every((i) => CAN_DO.test(i));
}

// KIYAS-11: a coursebook page sets some of its exercises on a tinted panel;
// ours were all on white. On a mirrored page every second exercise gets the
// book's panel tone (palette.primaryLight - the source's own tint, Faz G1).
export const PANEL_PAD = 6;

export function panelledExercises<B extends BlockLike>(blocks: B[]): Set<B> {
  return new Set(blocks.filter((b) => isExerciseBlock(b) && !b.callout).filter((_, i) => i % 2 === 1));
}

export function isExerciseBlock(b: BlockLike): boolean {
  return (!!b.items?.length || !!b.interactive || !!b.activity || b.diagram?.type === "prepositions") && !isChecklistBlock(b);
}

// ---- Height estimate ----
// A deliberately simple model of how tall a page's content prints, in pt.
// It doesn't need to be exact - only good enough to tell "fits on one
// page" from "clearly doesn't", so a template that would spill onto a
// second page (which looks broken in a designed spread) is caught before
// printing. Calibrated against the fixture renders in
// src/lib/pdf/BookDocument.templates.test.tsx.

export type PageMetrics = { width: number; height: number; bodySize: number };
export const A4_METRICS: PageMetrics = { width: 595.28, height: 841.89, bodySize: 10.5 };

const MARGIN_X = 44;
const MARGIN_TOP = 44;
export const MARGIN_BOTTOM = 56;
const RUNNING_HEADER = 22;
const UNIT_HEADING = 52;
// Lesson furniture (src/lib/pdf/lesson-furniture.tsx): the lesson tab takes
// a unit heading's room (a page with one is measured as headed), a section
// head this much above its exercise.
export const LESSON_TAB_HEIGHT = UNIT_HEADING;
export const SECTION_HEAD_HEIGHT = 20;
const LINE = 1.45;
// Line height of the body text on a mirrored page, set explicitly in pt by
// the PDF renderer (templates.tsx) - a coursebook's tight setting.
export const DENSE_LINE = 1.22;
// The heading line of a dense exercise (number at 1.25x, heading 1.1x the
// body): its own line height in body sizes, so a heading and rubric that
// wrap do not print over each other under the body's tight line.
export const HEADING_LINE = 1.45;
const CHAR_W = 0.5; // average glyph width as a fraction of the font size

function textHeight(text: string, width: number, size: number, line = LINE): number {
  if (!text) return 0;
  const perLine = Math.max(8, Math.floor(width / (size * CHAR_W)));
  const lines = text.split(/\n+/).reduce((n, para) => n + Math.max(1, Math.ceil(para.length / perLine)), 0);
  return lines * size * line;
}

// `frameless`: printed without the card frame and exercise box, the way a
// published coursebook sets an exercise (source-zones pages).
// Faz G4 "Kaynağın yoğunluğu": on a mirrored (frameless) page an exercise
// is set like a coursebook's - a short rubric runs on after the heading in
// one line, and short items sit side by side - instead of the card style's
// heading line, rubric line and one line per item. A source page holds 180+
// words and a third of a page of pictures; set card-style, the same words
// left room for a picture a third that size.
export const INLINE_RUBRIC_MAX = 160;

// An artefact (a message, an invitation...) is never run on after the heading.
export function inlineRubric(b: { body?: string; heading?: string; dialogue?: unknown[] | null; textStyle?: TextStyle; items?: string[] }): boolean {
  return !!b.heading && !!b.body && b.body.length <= INLINE_RUBRIC_MAX && !b.body.includes("\n") && !b.dialogue?.length && !resolveTextStyle(b);
}

// Artefact boxes (src/lib/pdf/artefacts.tsx draws them, artefactHeight
// measures them): padding, the share of the text width a narrow one takes,
// and their extra parts in body sizes (a title) or pt.
export const ARTEFACT_BOX = {
  note: { pad: 9, width: 0.72, top: 8, font: 1.08 },
  email: { pad: 8, header: 18 },
  message: { pad: 8, width: 0.7 },
  invitation: { pad: 12, title: 1.8 },
  quiz: { pad: 9, gap: 5 },
  poster: { pad: 10, title: 1.6 },
} as const;

// Height (pt) the artefact takes in place of the block's body text (and,
// for a quiz, its item list) - see ArtefactBody.
function artefactHeight(style: TextStyle, b: BlockLike, inner: number, size: number, th: (text: string, w: number, s: number) => number): number {
  const { lead, text } = splitArtefact(b.body ?? "");
  const leadH = lead ? th(lead, inner, size) + 4 : 0;
  const letter = (w: number, s: number) => {
    const p = letterParts(text);
    return th(p.greeting, w, s) + th(p.body, w, s) + (p.signOff ? th(p.signOff, w, s) + 3 : 0) + (p.greeting ? 2 : 0);
  };
  const margins = 8; // marginTop 2 + marginBottom 6
  switch (style) {
    case "note": {
      const box = ARTEFACT_BOX.note;
      return leadH + box.top + margins + 2 * box.pad + letter(inner * box.width - 2 * box.pad, size * box.font) + 4;
    }
    case "email": {
      const box = ARTEFACT_BOX.email;
      return leadH + margins + box.header + 2 * box.pad + 2 + letter(inner - 2 * box.pad, size);
    }
    case "message": {
      const box = ARTEFACT_BOX.message;
      return leadH + margins + 2 * box.pad + 5 + 8 + 12 + 10 + th(text, inner * box.width - 2 * box.pad - 21, size);
    }
    case "invitation": {
      const box = ARTEFACT_BOX.invitation;
      const { title, rest } = artefactTitle(text);
      const p = letterParts(rest);
      const w = inner - 2 * box.pad - 22; // the balloons' margin
      const textH = th(p.greeting, w, size * 1.05) + th(p.body, w, size * 1.05) + (p.signOff ? th(p.signOff, w, size * 1.05) + 3 : 0);
      return leadH + margins + 2 * box.pad + (title ? size * box.title * 1.25 + 4 : 0) + Math.max(40, textH);
    }
    case "poster": {
      const box = ARTEFACT_BOX.poster;
      const { title, rest } = artefactTitle(text);
      return leadH + margins + 2 * (box.pad + 4) + (title ? th(title, inner - 2 * box.pad - 8, size * box.title) + 3 : 0) + th(rest, inner - 2 * box.pad - 8, size);
    }
    case "quiz": {
      const box = ARTEFACT_BOX.quiz;
      const w = inner - 2 * box.pad;
      const rows = (b.items ?? []).reduce((n, item) => {
        const { question, options } = quizParts(item);
        return n + th(`00 ${question}`, w, size) + (options.length ? Math.max(size * 1.25, th(options.map((o) => `00 ${o.text}`).join("    "), w - 10, size)) + 1 : 0) + box.gap;
      }, 0);
      return leadH + margins + 2 * box.pad + (text ? th(text, w, size * 0.95) + 5 : 0) + rows;
    }
  }
}

// Columns for an item list on a mirrored page: short items side by side.
// Sized for the narrowest place a block goes (half a page), so it holds in
// a column band too.
export function itemColumns(items: string[] | undefined): 1 | 2 | 3 {
  if (!items || items.length < 3) return 1;
  const longest = Math.max(...items.map((i) => i.length));
  if (items.length >= 4 && longest <= 12) return 3;
  return longest <= 22 ? 2 : 1;
}

export function estimateBlockHeight(b: BlockLike, width: number, size: number, frameless = false): number {
  const inner = frameless ? width : width - 24;
  // Faz G4: mirrored pages are set at a tighter line (DENSE_LINE).
  const line = frameless ? DENSE_LINE : LINE;
  const th = (text: string, w: number, s: number) => textHeight(text, w, s, line);
  const artefact = resolveTextStyle(b);
  const bodyH = artefact ? artefactHeight(artefact, b, inner, size, th) : th(b.body, inner, size);
  let h = (frameless && b.section ? SECTION_HEAD_HEIGHT : 0) + (frameless
    ? 8 +
      (inlineRubric(b)
        ? textHeight(`${b.heading} ${b.body}`, inner, size * 1.1, HEADING_LINE / 1.1) + 3
        : (b.heading ? textHeight(b.heading, inner, size * 1.1, HEADING_LINE / 1.1) + 3 : 0) + bodyH)
    : 30 + (b.heading ? size * 1.9 : 0) + bodyH);
  if (b.dialogue?.length) {
    // avatar row: speaker label + padding + border ≈ 33pt over the text itself
    for (const d of b.dialogue) h += Math.max(30, th(d.line, inner * 0.78 - 20, size) + 33) + 8;
  }
  if (b.table) {
    const cell = inner / Math.max(1, b.table.headers.length);
    h += 24 + b.table.rows.reduce((n, row) => n + Math.max(...row.map((c) => th(c, cell - 10, 9)), 12) + 10, 0);
  }
  // A map prints under the block text, items or not.
  if (b.diagram?.type === "map") h += diagramHeight(b).extra;
  if (isChecklistBlock(b)) {
    h += (b.items ?? []).reduce((n, i) => n + th(i, inner - 20, size) + 6, 0);
  } else if (artefact === "quiz") {
    // the quiz box holds the items (artefactHeight)
  } else if (b.items?.length || b.interactive || b.activity) {
    h += frameless ? 8 : 44;
    const act = safeActivityHeight(b, inner - 24, size);
    const dia = diagramHeight(b);
    h += act.extra + (dia.replacesItems ? dia.extra : 0);
    const tiles = !b.activity ? tileKind(b.items) : null;
    if (tiles) h += tilesHeight(tiles, b.items?.length ?? 0, inner);
    else if (!act.replacesItems && !dia.replacesItems) {
      const cols = frameless && b.activity?.type !== "write_lines" ? itemColumns(b.items) : 1;
      if (cols > 1) h += Math.ceil((b.items?.length ?? 0) / cols) * (size * line + 3);
      else for (const i of b.items ?? []) h += th(i, inner - 24, size) + 3;
    }
    const it = b.interactive;
    if (it?.type === "multiple_choice") h += (it.options.length + 1) * size * line + 6;
    if (it?.type === "matching") h += it.pairs.length * size * line + 6;
    if (it?.type === "fill_blank") h += th(it.template, inner - 24, size) + 6;
  }
  return h;
}

// Number cards and colour pencils as ItemTiles draws them (44pt cards, 8pt
// gaps, ten numbers 5 + 5; a pencil column ~70pt wide and ~48pt tall).
function tilesHeight(kind: "numbers" | "colors", n: number, width: number): number {
  const cell = kind === "numbers" ? 44 : 70;
  const tall = kind === "numbers" ? 44 : 48;
  let perRow = Math.max(1, Math.floor((width + 8) / (cell + 8)));
  if (kind === "numbers" && n > 7) perRow = Math.min(perRow, Math.ceil(n / Math.ceil(n / 7)));
  return 4 + Math.ceil(n / perRow) * (tall + 8);
}

// An estimate must never take a run down (live run 2026-10-13: one bad
// crossword threw inside the fit check and failed the whole unit).
function safeActivityHeight(b: BlockLike, width: number, size: number): { extra: number; replacesItems: boolean } {
  try {
    return activityHeight(b, width, size);
  } catch {
    return { extra: 0, replacesItems: false };
  }
}

function stack(blocks: BlockLike[], width: number, size: number): number {
  return blocks.reduce((n, b) => n + estimateBlockHeight(b, width, size), 0);
}

function glossaryHeight(page: PageLike, columns: number): number {
  const n = page.glossary?.length ?? 0;
  return n ? 28 + Math.ceil(n / columns) * 70 : 0;
}

/** Content height a template needs vs. what the page offers, both in pt. */
// Measured against real renders (live E2E 2026-10-09/10, 27 pages from two
// books): the raw model underestimates multi-column arrangements - narrow
// columns wrap far more than an average glyph width predicts. These factors
// make "needed > available" match "actually spilled" on that sample.
const TEMPLATE_SAFETY: Partial<Record<ResolvedTemplate, number>> = {
  "two-column": 1.25,
  "reading-with-sidebar": 1.12,
  "image-left-text-right": 1.12,
  "exercise-grid": 1.08,
  // Faz G2: was 1.3, which sent most mirrored pages to the framed
  // templates before they were ever tried. A zoned page that does run over
  // is now measured and set tighter (renderBookFitted), so the estimate
  // only needs to be roughly right.
  "source-zones": 1.1,
  // Plain flow stacks a picture, unit heading and every block full-width;
  // in the sample it spilled from an estimated 73%.
  standard: 1.4,
};

export function estimateTemplateFit(
  page: PageLike,
  template: ResolvedTemplate,
  hasImage: boolean,
  isUnitFirstPage: boolean,
  m: PageMetrics = A4_METRICS,
  pictureCount = hasImage ? 1 : 0,
  tight = false,
): { needed: number; available: number } {
  const raw = template === "source-zones" ? zoneFit(page, pictureCount, isUnitFirstPage, m, tight) : rawTemplateFit(page, template, hasImage, isUnitFirstPage, m);
  return { needed: raw.needed * (TEMPLATE_SAFETY[template] ?? 1), available: raw.available };
}

// Gap between zone bands, and between a split band's picture and text.
export const ZONE_GAP = 12;

// Faz G3: the widest frame a picture is drawn in. Generated pictures are at
// most 3:2 (square in free mode); cropped into a longer strip they lose
// their subject (live re-layout of KIYAS-7: a ball and a desk cut in half,
// still at 2:1), so a wider slot keeps the picture at this shape, centred.
export const MAX_PICTURE_ASPECT = 1.6;

// KIYAS-13: a picture grown past its source size (a page with measured
// room left, see planZones) keeps most of what was drawn - its frame stays
// at least this share of the drawn picture's shape, so object-fit "cover"
// never crops more than a fifth of it away.
const MIN_FRAME_SHARE = 0.8;
// An edge-to-edge frame no wider than this (width / height) - a 3:2 picture
// cropped to it keeps three quarters of its height.
const MAX_BLEED_ASPECT = 2;
// A split band's picture column never takes more of the width than this.
const MAX_SPLIT_WIDTH = 0.55;

// The frames of a zoned picture row at a picture scale, in pt: the row's
// offset and width in the content area, its height and each picture's
// frame width. Below 1 a row shrinks as a whole (Faz G2); above 1 it grows
// toward the full content width and down the page (KIYAS-13: the source's
// pictures take 70-90% of a page, ours a quarter), until a frame would crop
// its picture deeper than MIN_FRAME_SHARE. Shared by the fit estimate and
// the PDF renderer so they agree.
export function zoneRowFrames(
  band: { height: number; widths: number[]; left?: number; span?: number; bleed?: boolean },
  contentWidth: number,
  pageHeight: number,
  scale: number,
): { left: number; width: number; height: number; frames: number[]; bleed?: boolean } {
  const sourceSpan = band.span ?? 1;
  const gaps = ZONE_GAP * (band.widths.length - 1);
  const base = band.height * pageHeight;
  if (band.bleed) {
    // Edge to edge (2026-10-24): the row takes the page's whole width, its
    // frames filled to the edge (cropped, not boxed at MAX_PICTURE_ASPECT) -
    // unless they would crop a picture to a strip; then it is set as usual.
    const width = contentWidth + 2 * MARGIN_X;
    const slots = band.widths.map((w) => (width - gaps) * w);
    const deepest = Math.min(...slots.map((s, k) => s / (MIN_FRAME_SHARE * shapeAspect((band.widths[k] * PAGE_ASPECT) / band.height))));
    const height = Math.round(scale <= 1 ? base * scale : Math.max(base, Math.min(base * scale, deepest)));
    if (slots.every((s) => s / height <= MAX_BLEED_ASPECT)) return { left: -MARGIN_X, width, height, frames: slots, bleed: true };
  }
  if (scale <= 1) {
    const width = contentWidth * sourceSpan;
    const height = Math.round(base * scale);
    return { left: contentWidth * (band.left ?? 0), width, height, frames: band.widths.map((w) => Math.min((width - gaps) * w * scale, height * MAX_PICTURE_ASPECT)) };
  }
  // Wider, staying centred where the source's row is.
  const span = Math.min(1, sourceSpan * scale);
  const left = Math.min(Math.max(0, (band.left ?? 0) + (sourceSpan - span) / 2), 1 - span);
  const width = contentWidth * span;
  const slots = band.widths.map((w) => (width - gaps) * w);
  const deepest = Math.min(...slots.map((s, k) => s / (MIN_FRAME_SHARE * shapeAspect((sourceSpan * band.widths[k] * PAGE_ASPECT) / band.height))));
  const height = Math.round(Math.max(base, Math.min(base * scale, deepest)));
  return { left: contentWidth * left, width, height, frames: slots.map((s) => Math.min(s, height * MAX_PICTURE_ASPECT)) };
}

// A split band's picture column (width, total height) at a picture scale.
export function zoneSplitFrame(
  band: { height: number; imageWidth: number },
  pictures: number,
  contentWidth: number,
  pageHeight: number,
  scale: number,
): { width: number; height: number } {
  const base = band.height * pageHeight;
  if (scale <= 1) return { width: contentWidth * band.imageWidth * scale, height: Math.round(base * scale) };
  const n = Math.max(1, pictures);
  const width = contentWidth * Math.min(MAX_SPLIT_WIDTH, band.imageWidth * scale);
  const deepest = (n * width) / (MIN_FRAME_SHARE * shapeAspect((band.imageWidth * PAGE_ASPECT) / (band.height / n))) + ZONE_GAP * (n - 1);
  return { width, height: Math.round(Math.max(base, Math.min(base * scale, deepest))) };
}

// A picture inside a column band (width, height) at a picture scale.
export function zoneColumnFrame(itemHeight: number, columnWidth: number, pageHeight: number, scale: number): { width: number; height: number } {
  const base = itemHeight * pageHeight;
  if (scale <= 1) return { width: columnWidth * scale, height: Math.round(base * scale) };
  const deepest = columnWidth / (MIN_FRAME_SHARE * shapeAspect((0.48 * PAGE_ASPECT) / itemHeight));
  return { width: columnWidth, height: Math.round(Math.max(base, Math.min(base * scale, deepest))) };
}

// Gaps on a zoned page that take a share of leftover height (planZones
// `spread`): between bands, and between blocks of a one-column text area.
export function zoneSpreadGaps<B>(bands: ZonedBand<B>[]): number {
  let n = Math.max(0, bands.length - 1);
  for (const b of bands) if ((b.kind === "text" && b.columns === 1) || b.kind === "split") n += Math.max(0, b.blocks.length - 1);
  return n;
}

// The one place a zoned page is measured, shared by the fit estimate and
// both renderers so they agree: the bands with their blocks, and how far the
// pictures are scaled down (to at most half their source height) so the
// text fits beside and between them. A page still too full gets its body
// text set 10% smaller (textScale), as a dense coursebook page is, before
// it gives up the source's arrangement. `tight` (a page that was measured
// running over, see renderBookFitted) goes further - text to 82%, pictures
// to 30% - before the page is given up to plain flow. Pictures shrink as a
// whole (width with height), so a scaled picture is never cropped to a
// strip.
//
// `measuredSlack` (Faz G3): the empty height (pt) a render of this page
// actually left at its foot. The estimate is then corrected by how much it
// overstated the page - pictures had been shrunk to a third of the
// source's size on pages that ended a sixth of a page short. Picture frames
// are exact, so the error is the text's: KIYAS-13 measures it as a factor on
// the text estimate (a page's text was estimated at up to twice its printed
// height), which still holds when the text is set at another size - an
// absolute correction did not, and left pages short of growing.
//
// KIYAS-13: a page that has its pictures at full size and still room left
// grows into it - pictures past the source's size (pictureScale above 1, see
// zoneRowFrames), then the text (textScale above 1; further on a page with
// no picture at all), and whatever is left is spread between the bands and
// blocks (`spread`, pt per gap) instead of pooling at the foot.
export type ZonePlanResult<B> = {
  bands: ZonedBand<B>[];
  pictureScale: number;
  textScale: number;
  contentHeight: number;
  needed: number;
  spread: number;
};

export function planZones<B extends BlockLike>(
  page: { blocks: B[]; glossary?: unknown[]; zonePlan?: ZonePlan | null },
  pictureCount: number,
  isUnitFirstPage: boolean,
  m: PageMetrics,
  tight = false,
  measuredSlack = 0,
): ZonePlanResult<B> {
  const contentHeight = m.height - MARGIN_TOP - MARGIN_BOTTOM - RUNNING_HEADER - (isUnitFirstPage ? UNIT_HEADING : 0);
  if (!page.zonePlan) return { bands: [], pictureScale: 1, textScale: 1, contentHeight, needed: Infinity, spread: 0 };
  if (measuredSlack > 0) {
    const first = planZones(page, pictureCount, isUnitFirstPage, m, tight);
    // The text factor that makes the estimate match what the page really
    // used, by bisection (the estimate grows with it).
    const used = contentHeight - measuredSlack;
    const { neededAt } = measureZones(page, pictureCount, m, contentHeight, first.textScale);
    let [lo, hi] = [MIN_TEXT_FACTOR, MAX_TEXT_FACTOR];
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (neededAt(first.pictureScale, mid) > used) hi = mid;
      else lo = mid;
    }
    // An overstatement is trusted to 95% (the measured slack already keeps a margin).
    return choosePlan(page, pictureCount, m, contentHeight, tight, lo < 1 ? lo + (1 - lo) * 0.05 : lo, true);
  }
  return choosePlan(page, pictureCount, m, contentHeight, tight, undefined, false);
}

// [textScale, pictureScale] in the order a full page gives way. KIYAS-11
// (live, 2026-10-18): with source-sized content the pictures went first and
// ended at 30% of the source's - pages of tiny clip-art. The source's
// pictures are its look, so the text gives way first (to 85%, a size
// coursebooks still print at), and pictures go below 70% only after that
// (below 50% only on a page measured running over).
const ZONE_STEPS: [number, number][] = [
  [1, 1], [1, 0.9], [0.92, 0.9], [0.92, 0.8], [0.85, 0.8], [0.85, 0.7], [0.85, 0.6], [0.85, 0.5],
];
const TIGHT_STEPS: [number, number][] = [...ZONE_STEPS, [0.85, 0.4], [0.8, 0.4], [0.8, 0.3]];

// Growth into measured room (KIYAS-13): pictures up to 3x the source's size
// (their frames stop earlier, see zoneRowFrames), then text - a little on a
// page with pictures, more on a page that has nothing else to fill it.
const GROW_STEP = 0.1;
const MAX_PICTURE_GROW = 3;
const MAX_TEXT_GROW = 1.2;
const MAX_TEXT_GROW_BARE = 1.5;
// No more than this between two bands or blocks: a page with little on it
// keeps its content together rather than scattering it.
const MAX_SPREAD = 40;
// Bounds of the measured text factor (planZones `measuredSlack`).
const MIN_TEXT_FACTOR = 0.3;
const MAX_TEXT_FACTOR = 3;

function choosePlan<B extends BlockLike>(
  page: { blocks: B[]; glossary?: unknown[]; zonePlan?: ZonePlan | null },
  pictureCount: number,
  m: PageMetrics,
  contentHeight: number,
  tight: boolean,
  textFactor: number | undefined,
  grow: boolean,
): ZonePlanResult<B> {
  let last: ZonePlanResult<B> = { bands: [], pictureScale: 0.5, textScale: 0.9, contentHeight, needed: Infinity, spread: 0 };
  const measured = new Map<number, ReturnType<typeof measureZones<B>>>();
  const at = (textScale: number) => {
    if (!measured.has(textScale)) measured.set(textScale, measureZones(page, pictureCount, m, contentHeight, textScale));
    return measured.get(textScale)!;
  };
  for (const [textScale, scale] of tight ? TIGHT_STEPS : ZONE_STEPS) {
    const { bands, neededAt } = at(textScale);
    const needed = neededAt(scale, textFactor);
    // A tight page already ran over at a size the estimate accepted, so
    // it is held to a stricter estimate.
    if (needed * (tight ? 1.15 : 1) <= contentHeight) {
      const fit = { bands, pictureScale: scale, textScale, contentHeight, needed, spread: 0 };
      return grow && scale >= 1 && textScale >= 1 ? growPlan(fit, at, textFactor) : fit;
    }
    last = { bands, pictureScale: scale, textScale, contentHeight, needed, spread: 0 };
  }
  return last;
}

function growPlan<B extends BlockLike>(
  fit: ZonePlanResult<B>,
  at: (textScale: number) => ReturnType<typeof measureZones<B>>,
  textFactor: number | undefined,
): ZonePlanResult<B> {
  const { contentHeight } = fit;
  const hasPictures = fit.bands.some((b) => b.kind === "pictures" || b.kind === "split" || (b.kind === "columns" && b.columns.flat().some((i) => i.kind === "picture")));
  let best = fit;
  const steps = (from: number, to: number) => Array.from({ length: Math.round((to - from) / GROW_STEP) }, (_, i) => Math.round((from + (i + 1) * GROW_STEP) * 100) / 100);
  // What growing adds is taken from the estimate at no less than its own
  // size: a measured factor below 1 fits the page as printed, but bigger
  // text (or text beside a wider picture) wraps onto new lines the factor
  // does not foresee - a KIYAS-13 opener ran over that way.
  const k = Math.max(1, textFactor ?? 1);
  const neededAt = (textScale: number, scale: number) => fit.needed + at(textScale).neededAt(scale, k) - at(1).neededAt(1, k);
  if (hasPictures) {
    for (const scale of steps(1, MAX_PICTURE_GROW)) {
      const needed = neededAt(1, scale);
      if (needed > contentHeight) break;
      // only a step that actually makes a frame bigger
      if (needed > best.needed + 0.5) best = { ...best, pictureScale: scale, needed };
    }
  }
  for (const textScale of steps(1, hasPictures ? MAX_TEXT_GROW : MAX_TEXT_GROW_BARE)) {
    const needed = neededAt(textScale, best.pictureScale);
    if (needed > contentHeight) break;
    best = { ...best, bands: at(textScale).bands, textScale, needed };
  }
  const gaps = zoneSpreadGaps(best.bands);
  const spread = gaps ? Math.min(MAX_SPREAD, Math.max(0, contentHeight - best.needed) / gaps) : 0;
  return { ...best, spread: Math.floor(spread) };
}

function measureZones<B extends BlockLike>(
  page: { blocks: B[]; glossary?: unknown[]; zonePlan?: ZonePlan | null },
  pictureCount: number,
  m: PageMetrics,
  contentHeight: number,
  textScale: number,
) {
  const cw = m.width - MARGIN_X * 2;
  const size = m.bodySize * textScale;
  const panels = panelledExercises(page.blocks);
  const height = (b: B, w: number) =>
    panels.has(b) ? estimateBlockHeight(b, w - 2 * PANEL_PAD, size, true) + 2 * PANEL_PAD : estimateBlockHeight(b, w, size, true);
  const bands = layoutZones(page.zonePlan!, page.blocks, pictureCount, (b) => height(b, cw));
  // `measured`: the text factor a render measured (planZones
  // `measuredSlack`) - every text height is taken at that many times its
  // estimate, and as picture frames are exact no safety factor is added.
  const neededAt = (scale: number, measured?: number) => {
    const k = measured ?? 1;
    const column = (blocks: B[], w: number) => blocks.reduce((n, b) => n + height(b, w), 0) * k;
    let needed = glossaryHeight(page, 3) * k;
    for (const band of bands) {
      if (band.kind === "pictures") needed += zoneRowFrames(band, cw, m.height, scale).height + ZONE_GAP;
      else if (band.kind === "split") {
        // the picture column narrows with the picture (Faz G2)
        const frame = zoneSplitFrame(band, band.pictures.length, cw, m.height, scale);
        const textW = cw - frame.width - ZONE_GAP;
        needed += Math.max(frame.height, column(band.blocks, textW)) + ZONE_GAP;
      } else if (band.columns === 2) {
        const col = (cw - 16) / 2;
        const heights = band.blocks.map((b) => height(b, col));
        const total = heights.reduce((a, b) => a + b, 0);
        let left = 0;
        let right = 0;
        for (const h of heights) {
          if (left < total / 2) left += h;
          else right += h;
        }
        needed += Math.max(left, right) * k + ZONE_GAP;
      } else if (band.kind === "columns") {
        const col = (cw - 16) / 2;
        const heights = band.columns.map((items) =>
          items.reduce((n, i) => n + (i.kind === "picture" ? zoneColumnFrame(i.height, col, m.height, scale).height : column(i.blocks, col)) + ZONE_GAP, 0),
        );
        needed += Math.max(...heights);
      } else needed += column(band.blocks, cw) + ZONE_GAP;
    }
    return measured === undefined ? needed * (TEMPLATE_SAFETY["source-zones"] ?? 1) : needed;
  };
  return { bands, neededAt };
}

function zoneFit(page: PageLike, pictureCount: number, isUnitFirstPage: boolean, m: PageMetrics, tight = false): { needed: number; available: number } {
  const { needed, contentHeight } = planZones(page, pictureCount, isUnitFirstPage, m, tight);
  // planZones already applies the safety factor; undo the one
  // estimateTemplateFit adds on top.
  return { needed: needed / (TEMPLATE_SAFETY["source-zones"] ?? 1), available: contentHeight };
}

function rawTemplateFit(
  page: PageLike,
  template: ResolvedTemplate,
  hasImage: boolean,
  isUnitFirstPage: boolean,
  m: PageMetrics,
): { needed: number; available: number } {
  const cw = m.width - MARGIN_X * 2;
  const size = m.bodySize;
  const H = m.height;
  const head = RUNNING_HEADER + (isUnitFirstPage ? UNIT_HEADING : 0);
  const available = H - MARGIN_TOP - MARGIN_BOTTOM - head;
  const img = (fraction: number) => (hasImage ? Math.round(H * fraction) + 12 : 0);
  const blocks = page.blocks;

  switch (template) {
    case "unit-opener-hero": {
      const hero = Math.round(H * 0.42);
      const start = hero - 30 + 70; // title plate overlaps the hero's edge
      return { needed: stack(blocks, cw, size) + glossaryHeight(page, 3), available: H - MARGIN_BOTTOM - start };
    }
    case "full-bleed-illustration": {
      const text = blocks.reduce((n, b) => n + textHeight(b.body, cw - 64, size + 1) + (b.heading ? 24 : 0), 0) + 32;
      return { needed: text, available: H * 0.4 };
    }
    case "two-column": {
      const col = (cw - 16) / 2;
      const heights = blocks.map((b) => estimateBlockHeight(b, col, size));
      // Same greedy split as templates.tsx's splitColumns (by text weight,
      // approximated here by the estimated heights).
      const total = heights.reduce((a, b) => a + b, 0);
      let left = 0;
      let right = 0;
      for (const h of heights) {
        if (left < total / 2) left += h;
        else right += h;
      }
      return { needed: img(0.26) + Math.max(left, right) + glossaryHeight(page, 2), available };
    }
    case "image-left-text-right": {
      const leftW = cw * 0.44;
      const side = blocks.filter((b) => b.callout);
      const main = blocks.filter((b) => !b.callout);
      const leftH = (hasImage ? leftW * 1.15 + 12 : 0) + stack(side, leftW, size);
      return { needed: Math.max(leftH, stack(main, cw - leftW - 16, size)) + glossaryHeight(page, 2), available };
    }
    case "reading-with-sidebar": {
      const mainW = (cw - 14) * (1.8 / 2.8);
      const sideW = cw - 14 - mainW;
      const isSide = (b: BlockLike) => !!b.callout || isExerciseBlock(b);
      const mainH = img(0.22) + stack(blocks.filter((b) => !isSide(b)), mainW, size);
      const sideH = 20 + stack(blocks.filter(isSide), sideW - 20, size) + (page.glossary?.length ?? 0) * 16;
      return { needed: Math.max(mainH, sideH), available };
    }
    case "exercise-grid": {
      const intro = blocks.filter((b) => !isExerciseBlock(b));
      const ex = blocks.filter(isExerciseBlock);
      const col = ex.length === 1 ? cw : cw * 0.485;
      let grid = 0;
      for (let i = 0; i < ex.length; i += 2) {
        grid += Math.max(...ex.slice(i, i + 2).map((b) => estimateBlockHeight(b, col - 20, size) - 20)) + 24;
      }
      return { needed: img(0.2) + stack(intro, cw, size) + grid + glossaryHeight(page, 2), available };
    }
    case "vocab-cards":
      return { needed: img(0.2) + glossaryHeight(page, 3) + 10 + stack(blocks, cw, size), available };
    case "dialogue-strip":
      return { needed: img(0.24) + stack(blocks, cw, size) + glossaryHeight(page, 2), available };
    case "review-checklist":
      return { needed: stack(blocks, cw, size) + glossaryHeight(page, 2), available };
    case "standard":
      return { needed: img(0.27) + stack(blocks, cw, size) + glossaryHeight(page, 2), available };
    case "source-zones":
      return zoneFit(page, hasImage ? 1 : 0, isUnitFirstPage, m);
  }
}

// A template chosen from the content itself, for pages the writer left
// without one (older books, and live E2E 2026-10-09: the free model
// skipped the field on whole units). Same vocabulary a designer would use.
export function inferTemplate(page: PageLike, hasImage: boolean, isUnitFirstPage: boolean): LayoutTemplateId {
  const blocks = page.blocks;
  if (isUnitFirstPage && hasImage) return "unit-opener-hero";
  if (blocks.some((b) => b.dialogue?.length)) return "dialogue-strip";
  if (blocks.length && blocks.every((b) => isChecklistBlock(b) || isExerciseBlock(b)) && blocks.some(isChecklistBlock)) return "review-checklist";
  if (blocks.filter(isExerciseBlock).length >= 2) return "exercise-grid";
  if ((page.glossary?.length ?? 0) >= 4 && blocks.length <= 2) return "vocab-cards";
  if (blocks.some((b) => b.callout) && blocks.some((b) => b.body.length > 400)) return "reading-with-sidebar";
  if (hasImage && blocks.length <= 3) return "image-left-text-right";
  return "two-column";
}

// The single decision both renderers make, so the PDF and the web reader
// never disagree. Falls back when:
// - the page was hand-positioned in Dizilim (manual coordinates win),
// - the template needs a picture but the page has none (e.g. the image was
//   dragged away in Dizilim, or image generation failed),
// - a dialogue template has no dialogue to show,
// - the content can't fit the arrangement on one page - "standard" flow
//   then paginates it instead of a designed layout spilling half a card
//   onto the next page.
// `tight`: the page was measured running over (renderBookFitted) and is
// set tighter; a mirrored page then keeps the source's arrangement - the
// next measurement decides whether it has to go to plain flow.
export function resolvePageTemplate(
  page: PageLike,
  hasImage: boolean,
  {
    isUnitFirstPage = false,
    metrics = A4_METRICS,
    pictureCount = hasImage ? 1 : 0,
    tight = false,
  }: { isUnitFirstPage?: boolean; metrics?: PageMetrics; pictureCount?: number; tight?: boolean } = {},
): ResolvedTemplate {
  if (page.imageLayout || page.blocks.some((b) => b.layout)) return "standard";
  // Faz B2: a mirrored page is laid out like its source page whenever the
  // content fits that arrangement. Faz G2: also when its pictures are
  // missing (image generation failed or ran out of quota) - the picture
  // slots drop out (layoutZones) and the text keeps the source's bands and
  // columns. It used to fall back to the framed templates, which on a
  // free-quota run meant nearly every page.
  if (page.zonePlan) {
    if (tight) return "source-zones";
    const fit = estimateTemplateFit(page, "source-zones", hasImage, isUnitFirstPage, metrics, pictureCount);
    if (fit.needed <= fit.available) return "source-zones";
  }
  let id: LayoutTemplateId =
    page.layoutTemplate && page.layoutTemplate in LAYOUT_TEMPLATES ? page.layoutTemplate : inferTemplate(page, hasImage, isUnitFirstPage);
  if (LAYOUT_TEMPLATES[id].needsImage && !hasImage) id = "two-column";
  if (id === "dialogue-strip" && !page.blocks.some((b) => b.dialogue?.length)) id = "two-column";
  // Live E2E 2026-10-09: the design review switched one-block pages to this
  // template and its sidebar printed as an empty tinted box.
  if (id === "reading-with-sidebar" && !page.blocks.some((b) => b.callout || isExerciseBlock(b)) && !page.glossary?.length) {
    id = "two-column";
  }
  if (id === "exercise-grid" && !page.blocks.some(isExerciseBlock)) id = "two-column";
  if (id === "vocab-cards" && !page.glossary?.length) id = "two-column";
  const fit = estimateTemplateFit(page, id, hasImage, isUnitFirstPage, metrics);
  return fit.needed <= fit.available ? id : "standard";
}

// Writer-prompt catalogue - generated from LAYOUT_TEMPLATES so the prompt
// can never drift from what the renderers support.
export function layoutTemplatePromptCatalog(): string {
  return LAYOUT_TEMPLATE_IDS.map((id) => `- "${id}": ${LAYOUT_TEMPLATES[id].whenToUse}`).join("\n");
}

// Real coursebooks vary their page designs; a unit printed as five
// identical two-column pages reads as a template dump. Deterministic fix
// (no model call): when the same template appears 3+ times in a row, the
// third repeat is swapped for a compatible alternative. Only swaps between
// text-only templates, so no image requirement is broken.
const ROTATION: LayoutTemplateId[] = ["two-column", "reading-with-sidebar", "exercise-grid"];

export function diversifyTemplates<T extends { layoutTemplate?: LayoutTemplateId | null }>(pages: T[]): T[] {
  let run = 0;
  let prev: LayoutTemplateId | null | undefined;
  return pages.map((page) => {
    const id = page.layoutTemplate;
    run = id && id === prev ? run + 1 : 1;
    prev = id;
    if (!id || run < 3 || !ROTATION.includes(id)) return page;
    const alt = ROTATION.find((r) => r !== id) as LayoutTemplateId;
    prev = alt;
    run = 1;
    return { ...page, layoutTemplate: alt };
  });
}
