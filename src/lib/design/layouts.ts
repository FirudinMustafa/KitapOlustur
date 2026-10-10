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
export type ResolvedTemplate = LayoutTemplateId | "standard";

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
  layout?: unknown;
};

type PageLike = {
  layoutTemplate?: LayoutTemplateId | null;
  blocks: BlockLike[];
  glossary?: unknown[];
  imageLayout?: unknown;
};

// A self-assessment list ("I can introduce myself.") rather than an
// exercise - printed with tick boxes and exempt from the items/answerKey
// pairing rule (see validateUnitStructure).
const CAN_DO = /^\s*(I can|I know|I understand|I am able|I'm able)\b/i;

export function isChecklistBlock(b: { kind: string; items?: string[] }): boolean {
  if (!b.items?.length) return false;
  return b.kind === "reference" || b.items.every((i) => CAN_DO.test(i));
}

export function isExerciseBlock(b: BlockLike): boolean {
  return (!!b.items?.length || !!b.interactive) && !isChecklistBlock(b);
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
const MARGIN_BOTTOM = 56;
const RUNNING_HEADER = 22;
const UNIT_HEADING = 52;
const LINE = 1.45;
const CHAR_W = 0.5; // average glyph width as a fraction of the font size

function textHeight(text: string, width: number, size: number): number {
  if (!text) return 0;
  const perLine = Math.max(8, Math.floor(width / (size * CHAR_W)));
  const lines = text.split(/\n+/).reduce((n, para) => n + Math.max(1, Math.ceil(para.length / perLine)), 0);
  return lines * size * LINE;
}

export function estimateBlockHeight(b: BlockLike, width: number, size: number): number {
  const inner = width - 24;
  let h = 30 + (b.heading ? size * 1.9 : 0) + textHeight(b.body, inner, size);
  if (b.dialogue?.length) {
    // avatar row: speaker label + padding + border ≈ 33pt over the text itself
    for (const d of b.dialogue) h += Math.max(30, textHeight(d.line, inner * 0.78 - 20, size) + 33) + 8;
  }
  if (b.table) {
    const cell = inner / Math.max(1, b.table.headers.length);
    h += 24 + b.table.rows.reduce((n, row) => n + Math.max(...row.map((c) => textHeight(c, cell - 10, 9)), 12) + 10, 0);
  }
  if (isChecklistBlock(b)) {
    h += (b.items ?? []).reduce((n, i) => n + textHeight(i, inner - 20, size) + 6, 0);
  } else if (b.items?.length || b.interactive) {
    h += 44;
    for (const i of b.items ?? []) h += textHeight(i, inner - 24, size) + 3;
    const it = b.interactive;
    if (it?.type === "multiple_choice") h += (it.options.length + 1) * size * LINE + 6;
    if (it?.type === "matching") h += it.pairs.length * size * LINE + 6;
    if (it?.type === "fill_blank") h += textHeight(it.template, inner - 24, size) + 6;
  }
  return h;
}

function stack(blocks: BlockLike[], width: number, size: number): number {
  return blocks.reduce((n, b) => n + estimateBlockHeight(b, width, size), 0);
}

function glossaryHeight(page: PageLike, columns: number): number {
  const n = page.glossary?.length ?? 0;
  return n ? 28 + Math.ceil(n / columns) * 70 : 0;
}

/** Content height a template needs vs. what the page offers, both in pt. */
export function estimateTemplateFit(
  page: PageLike,
  template: ResolvedTemplate,
  hasImage: boolean,
  isUnitFirstPage: boolean,
  m: PageMetrics = A4_METRICS,
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
export function resolvePageTemplate(
  page: PageLike,
  hasImage: boolean,
  { isUnitFirstPage = false, metrics = A4_METRICS }: { isUnitFirstPage?: boolean; metrics?: PageMetrics } = {},
): ResolvedTemplate {
  if (page.imageLayout || page.blocks.some((b) => b.layout)) return "standard";
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
