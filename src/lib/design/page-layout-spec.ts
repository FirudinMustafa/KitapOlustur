import { z } from "zod";
import { TEXT_STYLES } from "@/lib/text-style";

// Plan "gör → tasarla → çiz → bak → düzelt" step 1 (2026-10-24): one page's
// design as a safe JSON description - what the agent designer
// (agent-designer.ts) writes and src/lib/pdf/spec-page.tsx draws with the
// book's existing pieces (picture frames, exercise cards, artefacts,
// labels and bubbles, lesson tab, footer). Free code never reaches the
// renderer: only boxes, colours and block indices.
//
// Coordinates are fractions of the trimmed page (0..1, origin top-left),
// the notation of docs/handmade-design-decisions.md ([x, y, w, h]).

const fraction = z.number().min(0).max(1);
export const specBoxSchema = z.object({
  x: fraction,
  y: fraction,
  w: z.number().gt(0).max(1),
  h: z.number().gt(0).max(1),
});
export type SpecBox = z.infer<typeof specBoxSchema>;

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "a #rrggbb colour");

export const specGroundSchema = z.object({
  box: specBoxSchema,
  color: color.describe("Printed colour; a dark one is lightened until black text stays legible on it."),
  radius: z.number().min(0).max(40).optional(),
});

export const specPictureSchema = z.object({
  picture: z.number().int().min(0).describe("Which of the page's pictures: 0 = main picture, 1.. = extra pictures, in the order listed."),
  box: specBoxSchema,
  bleed: z.boolean().optional().describe("Edges of the box that touch the page edge run on into the print bleed, square-cornered."),
  fit: z.enum(["cover", "contain"]).optional().describe("cover (default) fills the box and crops; contain shows the whole picture."),
  focus: z
    .object({ x: fraction, y: fraction })
    .optional()
    .describe("Where a cropped picture is anchored (0,0 = keep its top-left; default x 0.5, y 0.3). A picture of one object on a plain ground is always centred on its object."),
  radius: z.number().min(0).max(30).optional(),
  badge: z.string().min(1).max(3).optional().describe("A small number disc on the picture's top-left corner (numbered picture cards)."),
  labels: z.boolean().optional().describe("Print the page's located vocabulary labels on this picture (main picture only)."),
  bubbles: z.boolean().optional().describe("Print the page's located speech bubbles on this picture (main picture only); the dialogue's lines then leave its block."),
  ground: color.optional().describe("Tile colour behind a picture that does not fill its box."),
});

export const specRegionSchema = z.object({
  box: specBoxSchema,
  blocks: z.array(z.number().int().min(0)).min(1).describe("The content blocks printed here, by index, in reading order."),
  columns: z.union([z.literal(1), z.literal(2)]).optional(),
  panel: z
    .object({ tint: color, border: color.optional(), radius: z.number().min(0).max(30).optional() })
    .optional()
    .describe("A tinted panel behind the region's text."),
  artefact: z.enum(TEXT_STYLES).optional().describe("Print the region's texts as this designed object (a note, an e-mail window...)."),
  textScale: z.number().min(0.7).max(1.8).optional().describe("Type size against the book's body size (1 = as the book)."),
  rubricOnly: z
    .boolean()
    .optional()
    .describe("Print only the exercises' headings and rubrics: their items are what the page's numbered pictures show (picture cards), so they are not listed again."),
  over: z.boolean().optional().describe("The region sits over a picture on purpose (a rubric over a scene); it gets a white backing."),
});

export const pageLayoutSpecSchema = z.object({
  version: z.literal(1),
  grounds: z.array(specGroundSchema).max(6).optional().describe("Colour areas drawn first: a page ground, a side panel, a band."),
  pictures: z.array(specPictureSchema).max(12),
  regions: z.array(specRegionSchema).max(12),
  furniture: z
    .object({
      topBand: z.boolean().optional().describe("The source's measured band across the top edge."),
      footer: z.boolean().optional().describe("Topic pill and folio at the outer bottom corner (default on)."),
      titleTab: z.boolean().optional().describe("The page title on a tab over the top-left corner."),
      lessonTab: specBoxSchema.optional().describe("Where the lesson tab (code, title, Check these words box) prints, on a lesson's first page."),
    })
    .optional(),
  headings: z
    .object({ style: z.enum(["inline", "disc", "numeral"]).optional() })
    .optional()
    .describe("Exercise headings: inline = as the book measures it; disc = white number on a coloured disc; numeral = coloured number."),
});
export type PageLayoutSpec = z.infer<typeof pageLayoutSpecSchema>;
export type SpecPicture = z.infer<typeof specPictureSchema>;
export type SpecRegion = z.infer<typeof specRegionSchema>;

// Edges within this of the page edge count as touching it.
const EDGE = 0.005;
// Overlap (share of the page) still taken for two boxes meeting.
const TOUCH = 0.002;
// Text this close to the trim edge risks the guillotine.
export const SAFE_MARGIN = 0.03;

export const touches = (b: SpecBox) => ({
  left: b.x <= EDGE,
  top: b.y <= EDGE,
  right: b.x + b.w >= 1 - EDGE,
  bottom: b.y + b.h >= 1 - EDGE,
});

export function overlapArea(a: SpecBox, b: SpecBox): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

const fmt = (b: SpecBox) => `[${[b.x, b.y, b.w, b.h].map((v) => v.toFixed(2)).join(", ")}]`;

// What is wrong with a spec on its own - boxes off the page, boxes on top
// of each other, a block placed twice. Empty = drawable.
export function specIssues(spec: PageLayoutSpec): string[] {
  const issues: string[] = [];
  const boxes: { name: string; box: SpecBox }[] = [
    ...spec.pictures.map((p, i) => ({ name: `picture box ${i}`, box: p.box })),
    ...spec.regions.map((r, i) => ({ name: `region ${i}`, box: r.box })),
    ...(spec.grounds ?? []).map((g, i) => ({ name: `ground ${i}`, box: g.box })),
    ...(spec.furniture?.lessonTab ? [{ name: "lesson tab", box: spec.furniture.lessonTab }] : []),
  ];
  for (const { name, box } of boxes) {
    if (box.x + box.w > 1 + EDGE || box.y + box.h > 1 + EDGE) issues.push(`${name} ${fmt(box)} runs off the page.`);
  }
  for (let i = 0; i < spec.pictures.length; i++) {
    for (let k = i + 1; k < spec.pictures.length; k++) {
      if (overlapArea(spec.pictures[i].box, spec.pictures[k].box) > TOUCH) issues.push(`picture boxes ${i} and ${k} overlap.`);
    }
  }
  const textBoxes = [
    ...spec.regions.map((r, i) => ({ name: `region ${i}`, box: r.box, over: !!r.over })),
    ...(spec.furniture?.lessonTab ? [{ name: "lesson tab", box: spec.furniture.lessonTab, over: false }] : []),
  ];
  for (let i = 0; i < textBoxes.length; i++) {
    const a = textBoxes[i];
    for (let k = i + 1; k < textBoxes.length; k++) {
      if (overlapArea(a.box, textBoxes[k].box) > TOUCH) issues.push(`${a.name} and ${textBoxes[k].name} overlap.`);
    }
    if (a.over) continue;
    spec.pictures.forEach((p, k) => {
      if (overlapArea(a.box, p.box) > TOUCH) issues.push(`${a.name} overlaps picture box ${k} (set "over" only for text meant to sit on a picture).`);
    });
  }
  const placed = new Map<number, number>();
  spec.regions.forEach((r, i) => {
    for (const b of r.blocks) {
      if (placed.has(b)) issues.push(`block ${b} is placed twice (regions ${placed.get(b)} and ${i}).`);
      else placed.set(b, i);
    }
  });
  const used = new Set<number>();
  spec.pictures.forEach((p) => {
    if (used.has(p.picture)) issues.push(`picture ${p.picture} is placed twice.`);
    used.add(p.picture);
    if ((p.labels || p.bubbles) && p.picture !== 0) issues.push(`labels and bubbles are located on the main picture (0) only, not picture ${p.picture}.`);
  });
  return issues;
}

/** What the page has to place: its blocks (null = not printed on this page) and its pictures. */
export type SpecPageContent = { blocks: readonly (unknown | null)[]; pictureCount: number };

// What is wrong with a spec for this page's content: every printed block
// and every picture placed once, nothing that is not there.
export function specContentIssues(spec: PageLayoutSpec, content: SpecPageContent): string[] {
  const issues: string[] = [];
  const placed = new Set(spec.regions.flatMap((r) => r.blocks));
  for (const b of placed) {
    if (b >= content.blocks.length) issues.push(`block ${b} does not exist (the page has ${content.blocks.length}).`);
    else if (content.blocks[b] === null) issues.push(`block ${b} is not printed on this page - leave it out.`);
  }
  content.blocks.forEach((b, i) => {
    if (b !== null && !placed.has(i)) issues.push(`block ${i} is not placed - every printed block must go in a region.`);
  });
  const pictures = new Set(spec.pictures.map((p) => p.picture));
  for (const p of pictures) if (p >= content.pictureCount) issues.push(`picture ${p} does not exist (the page has ${content.pictureCount}).`);
  for (let p = 0; p < content.pictureCount; p++) if (!pictures.has(p)) issues.push(`picture ${p} is not placed - every picture must go in a box.`);
  return issues;
}

// Advice, not errors: text in the trim margin.
export function specWarnings(spec: PageLayoutSpec): string[] {
  const out: string[] = [];
  spec.regions.forEach((r, i) => {
    const t = touches(r.box);
    if (r.box.x < SAFE_MARGIN || r.box.y < SAFE_MARGIN || r.box.x + r.box.w > 1 - SAFE_MARGIN || r.box.y + r.box.h > 1 - SAFE_MARGIN || t.left || t.right) {
      out.push(`region ${i} ${fmt(r.box)} reaches into the ${SAFE_MARGIN * 100}% trim margin - text there can be cut.`);
    }
  });
  return out;
}

/** Parses untrusted JSON (a model's tool input, a stored field) into a spec, or the reasons it is not one. */
export function parseSpec(input: unknown): { spec: PageLayoutSpec; issues: string[] } | { spec: null; issues: string[] } {
  const parsed = pageLayoutSpecSchema.safeParse(input);
  if (!parsed.success) return { spec: null, issues: parsed.error.issues.map((i) => `${i.path.join(".") || "spec"}: ${i.message}`) };
  return { spec: parsed.data, issues: specIssues(parsed.data) };
}
