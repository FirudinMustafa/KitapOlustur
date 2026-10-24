import { generateText, stepCountIs, tool, type LanguageModel, type LanguageModelUsage, type ModelMessage, type StopCondition, type ToolSet } from "ai";
import { z } from "zod";
import type { ContentBlock } from "@/lib/ai/schemas";
import { BOOK_PIPELINE_MODEL } from "@/lib/ai/model";
import { textCostUsd } from "@/lib/ai/pricing";
import type { SourcePageLayout } from "@/lib/source-layout";
import { pageLayoutSpecSchema, parseSpec, specContentIssues, specWarnings, type PageLayoutSpec } from "./page-layout-spec";

// Plan "gör → tasarla → çiz → bak → düzelt" step 1 (2026-10-24): the agent
// designer. A hand-made page beats the template path because its maker
// looks at the source page, designs this page for it, renders it, looks at
// the result and fixes it (5-20 rounds a page). This loop gives the
// pipeline's own model (Sonnet 5.5) the same: the source page as an image,
// the page's approved content and pictures, and two tools -
//   render(spec)  -> the page drawn from the spec, as an image, with which
//                    regions run over and the look metrics against the
//                    source (hints only),
//   finish(spec)  -> accepted only when the spec draws every printed block
//                    and picture once, with nothing on top of anything and
//                    no text running over.
// It returns the accepted spec, or null (no turns, no budget, or never a
// clean spec) - the caller then prints the page by today's template path.
//
// Pure of I/O itself: the page drawing (render) and the usage accounting
// (onUsage) are injected, so the loop runs against a scripted fake model
// in tests and scripts at no cost.

export const DEFAULT_MAX_TURNS = 6;
// Sonnet 5.5 at $2/$10 per M: a page of 6 turns with renders is ~$0.10.
export const DEFAULT_MAX_COST_USD = 0.3;
// Older renders keep their reports but lose their pictures past this many
// (each picture is ~1k input tokens on every later turn).
const KEEP_RENDER_IMAGES = 2;

/** What the render tool hands back for a spec (spec-page.tsx renderSpecPage + specLookHints). */
export type DesignRender = {
  png: Uint8Array;
  fits: { region: number; needed: number; available: number; overflow: boolean }[];
  look?: Record<string, number | null>;
};

export type DesignerInput = {
  /** The source page as an image (PNG). */
  sourcePng: Uint8Array;
  /** The source page as measured (analyzeSourceLayout). */
  sourceLayout: SourcePageLayout;
  /** The page's blocks as printed, index for index (null = not printed; spec-page printedBlocks). */
  blocks: (ContentBlock | null)[];
  /** The page's pictures, main first: their shape, and what each shows (its prompt). */
  pictures: { aspect: number | null; object: boolean; ground?: string; shows?: string }[];
  /** Furniture the page can print. */
  available: { topBand: boolean; lessonTab: boolean; labels: number; bubbles: number; titleTab?: string };
  /** Trim size (pt) and the book's body size (pt). */
  page: { width: number; height: number; bodySize: number; youngLearners: boolean };
  /** The source's colours (designColors), for grounds and panels. */
  colors?: string[];
  /** Section of the book, for context ("Starter Unit: Names"). */
  label?: string;
};

export type DesignerOptions = {
  model: LanguageModel;
  /** Prices the calls for the cost cap (pricing.ts); default the pipeline model. */
  pricingModel?: string;
  maxTurns?: number;
  maxCostUsd?: number;
  /** Draws a spec (renderSpecPage + look hints). */
  render: (spec: PageLayoutSpec) => Promise<DesignRender>;
  /** Each model call's usage, as it happens - recordUsage in the workflow. */
  onUsage?: (usage: LanguageModelUsage) => Promise<void> | void;
};

export type DesignResult = {
  spec: PageLayoutSpec | null;
  /** Model calls made. */
  turns: number;
  renders: number;
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number;
  /** Why the loop ended. */
  stopped: "finished" | "turns" | "budget" | "gave-up";
  log: string[];
};

// docs/handmade-design-decisions.md, condensed for the designer. Left out
// on purpose: the tricks that only move a measurement (drawing a text panel
// as an image so it counts as a picture, printing numbers small so they are
// not read as exercises) - the designer designs for readers.
export const DESIGN_RULES = `You are the layout designer of an English coursebook. You set ONE page: its content is written and approved, its pictures are made. You decide where everything goes, by writing a layout spec and rendering it.

What a good page looks like (from hand-made pages that matched the source book):
1. Pictures where the source page has its pictures, at about the same size. A big picture fills its box edge to edge (fit "cover"); one whose source picture touches the page edge runs off the edge (bleed: true, box touching the edge). Never leave a big empty area the source fills with a picture.
2. One picture area is one artwork. Numbered picture cards: equal boxes in a grid with a number badge each.
3. Colour as the source prints it: a coloured page ground, a side panel or a band where the source has one (grounds); tinted panels behind boxes the source prints as boxes (grammar box, tip, word box), or an artefact style for a text the source prints as an object (e-mail, note, invitation, poster). Light tints from the source's colours; text stays legible.
4. Exercise headings: the number and the rubric on one line; the first exercise no higher than 6% of the page height.
5. Columns: on a two-column source page keep two columns (regions about x 0.07-0.47 and 0.51-0.93, a gutter of at least 16 pt); nothing crosses the gutter. A one-column source page keeps full-width text.
6. Lesson furniture only where the source prints it (lesson tab on a lesson's first page, the top band, the footer).
7. Text: every printed block goes in a region, in reading order, nothing dropped; no region may run over (the render report says "overflow"); keep text 3% inside the page edge. A scene's dialogue may go in speech bubbles on its picture (bubbles: true) and a scene's words on labels (labels: true) when they are available.
8. Do not copy the source's design accidents: the coloured slivers at the left edge of a scanned page are the neighbour page's bleed, not a design element.

Originality: the content is original and must stay so. You never write text - the spec only places the given blocks by index. Do not try to make the page read like the source's wording.

The look numbers in the render report compare your page with the source (palette, ink, ink map, picture area). They are hints for where your page differs, not a target: never make a design worse for a reader to move a number.

How to work: render a first spec, compare the rendered page with the source page, fix what is wrong (overflow, overlaps, empty space, pictures too small or cropped badly) and render again. When the page is right, call finish with the same spec. You have a limited number of turns; finish before they run out.`;

function blockSummary(b: ContentBlock | null, i: number): string {
  if (!b) return `[${i}] (not printed on this page - leave it out)`;
  const parts = [`[${i}] ${b.kind}${b.callout ? ` callout:${b.callout}` : ""}${b.textStyle ? ` textStyle:${b.textStyle}` : ""}${b.section ? ` section:${b.section}` : ""}`, `heading: ${JSON.stringify(b.heading)}`];
  if (b.body) parts.push(`body (${b.body.split(/\s+/).length} words): ${JSON.stringify(b.body.length > 220 ? `${b.body.slice(0, 220)}…` : b.body)}`);
  if (b.items?.length) parts.push(`items (${b.items.length}): ${JSON.stringify(b.items.slice(0, 8))}${b.items.length > 8 ? "…" : ""}`);
  if (b.dialogue?.length) parts.push(`dialogue: ${b.dialogue.length} lines`);
  if (b.table) parts.push(`table: ${b.table.headers.length} columns × ${b.table.rows.length} rows`);
  if (b.activity) parts.push(`activity: ${b.activity.type}`);
  return parts.join("; ");
}

const round = (b: { x: number; y: number; w: number; h: number }) => `[${[b.x, b.y, b.w, b.h].map((v) => v.toFixed(2)).join(", ")}]`;

// The first message: the page to set, the source as measured, the source page itself.
export function designerBrief(input: DesignerInput): string {
  const l = input.sourceLayout;
  const lines = [
    `Page: ${input.page.width.toFixed(0)} × ${input.page.height.toFixed(0)} pt, body type ${input.page.bodySize.toFixed(1)} pt${input.page.youngLearners ? ", a young learners' book" : ""}.${input.label ? ` Section: ${input.label}.` : ""}`,
    "",
    "The source page (image attached) as measured:",
    `- pictures (x, y, w, h as page fractions): ${l.images.length ? l.images.map(round).join(" ") : "none"}`,
    `- text columns: ${l.textColumns}; exercises: ${l.exerciseCount}; words: ${l.wordCount}`,
    ...(l.furniture?.ground ? [`- coloured ground ${l.furniture.ground.color} at ${round(l.furniture.ground.box)}`] : []),
    ...(input.colors?.length ? [`- its colours: ${input.colors.join(" ")}`] : []),
    "",
    "Content blocks to place (by index):",
    ...input.blocks.map(blockSummary),
    "",
    "Pictures to place (by index):",
    ...input.pictures.map((p, i) => `[${i}] ${p.aspect ? `aspect ${p.aspect.toFixed(2)} (w/h)` : "aspect unknown"}, ${p.object ? `one object on a plain ${p.ground ?? ""} ground (centred in any box, the ground fills the rest)` : "a scene (cropped to fill its box)"}${p.shows ? `; shows: ${p.shows.slice(0, 160)}` : ""}`),
    "",
    `Available: top band ${input.available.topBand ? "yes" : "no"}; lesson tab ${input.available.lessonTab ? "yes (give it a box ~0.07 high at the top)" : "no"}; scene labels ${input.available.labels ? `${input.available.labels} on picture 0` : "none"}; speech bubbles ${input.available.bubbles ? `${input.available.bubbles} on picture 0` : "none"}${input.available.titleTab ? `; title tab "${input.available.titleTab}"` : ""}.`,
    "Footer (topic pill and folio) prints at the bottom ~0.06 of the page by default - keep text out of it.",
  ];
  return lines.join("\n");
}

// The model sees the spec schema (with its descriptions) as the tools' input.
const specInput = z.object({ spec: pageLayoutSpecSchema.describe("The page layout spec (version 1).") });
type SpecInput = z.infer<typeof specInput>;

// The spec the model sent, or why it cannot be drawn for this page.
function check(raw: unknown, input: DesignerInput): { spec: PageLayoutSpec; issues: string[] } | { spec: null; issues: string[] } {
  const parsed = parseSpec(typeof raw === "string" ? safeJson(raw) : raw);
  if (!parsed.spec) return parsed;
  return { spec: parsed.spec, issues: [...parsed.issues, ...specContentIssues(parsed.spec, { blocks: input.blocks, pictureCount: input.pictures.length })] };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Images of older renders replaced by a note, so every turn does not pay
// for every picture again.
export function dropOldRenderImages(messages: ModelMessage[], keep = KEEP_RENDER_IMAGES): ModelMessage[] {
  let seen = 0;
  const out = [...messages];
  for (let m = out.length - 1; m >= 0; m--) {
    const msg = out[m];
    if (msg.role !== "tool") continue;
    const content = msg.content.map((part) => {
      if (part.type !== "tool-result" || part.output.type !== "content") return part;
      const hasImage = part.output.value.some((v) => v.type === "image-data" || v.type === "media");
      if (!hasImage) return part;
      seen++;
      if (seen <= keep) return part;
      return { ...part, output: { type: "content" as const, value: [...part.output.value.filter((v) => v.type === "text"), { type: "text" as const, text: "(older render image omitted)" }] } };
    });
    out[m] = { ...msg, content };
  }
  return out;
}

export async function designPage(input: DesignerInput, options: DesignerOptions): Promise<DesignResult> {
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
  const maxCost = options.maxCostUsd ?? DEFAULT_MAX_COST_USD;
  const pricing = options.pricingModel ?? BOOK_PIPELINE_MODEL;
  const log: string[] = [];
  let accepted: PageLayoutSpec | null = null;
  let renders = 0;
  let spent = 0;
  const usage = { inputTokens: 0, outputTokens: 0 };

  const tools = {
    render: tool<SpecInput, { text: string; png?: string }>({
      description: "Draw the page from a layout spec. Returns the rendered page as an image, which regions run over, problems with the spec and look hints against the source.",
      inputSchema: specInput,
      execute: async ({ spec: raw }) => {
        const checked = check(raw, input);
        if (!checked.spec) return { text: `The spec is not valid:\n- ${checked.issues.join("\n- ")}` };
        renders++;
        const drawn = await options.render(checked.spec);
        const report = {
          problems: checked.issues,
          overflow: drawn.fits.filter((f) => f.overflow).map((f) => `region ${f.region} needs ${f.needed} pt, has ${f.available} pt`),
          regions: drawn.fits.map((f) => `region ${f.region}: needs ${f.needed} of ${f.available} pt`),
          warnings: specWarnings(checked.spec),
          lookVsSource: drawn.look,
        };
        log.push(`render ${renders}: ${report.problems.length} problems, ${report.overflow.length} overflowing${report.overflow.length ? ` (${report.overflow.join("; ")})` : ""}`);
        return { text: JSON.stringify(report), png: Buffer.from(drawn.png).toString("base64") };
      },
      toModelOutput: ({ output }) => ({
        type: "content",
        value: [
          { type: "text", text: output.text },
          ...(output.png ? [{ type: "image-data" as const, mediaType: "image/png", data: output.png }] : []),
        ],
      }),
    }),
    finish: tool<SpecInput, string>({
      description: "Hand in the final layout spec. Accepted only with no problems and no region running over; otherwise the reasons come back.",
      inputSchema: specInput,
      execute: async ({ spec: raw }) => {
        const checked = check(raw, input);
        if (!checked.spec) return `Not accepted, the spec is not valid:\n- ${checked.issues.join("\n- ")}`;
        if (checked.issues.length) return `Not accepted:\n- ${checked.issues.join("\n- ")}`;
        const drawn = await options.render(checked.spec);
        const over = drawn.fits.filter((f) => f.overflow);
        if (over.length) return `Not accepted, text runs over: ${over.map((f) => `region ${f.region} needs ${f.needed} pt, has ${f.available} pt`).join("; ")}.`;
        accepted = checked.spec;
        log.push("finish: accepted");
        return "Accepted.";
      },
    }),
  } satisfies ToolSet;

  const done: StopCondition<typeof tools> = () => accepted !== null;
  const broke: StopCondition<typeof tools> = () => spent >= maxCost;
  let turns = 0;
  try {
    await generateText({
      model: options.model,
      system: DESIGN_RULES,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: designerBrief(input), providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
            { type: "image", image: input.sourcePng, mediaType: "image/png" },
          ],
        },
      ],
      tools,
      stopWhen: [stepCountIs(maxTurns), done, broke],
      // The last turn may only hand in.
      prepareStep: ({ stepNumber, messages }) => ({
        messages: dropOldRenderImages(messages),
        ...(stepNumber >= maxTurns - 1 ? { toolChoice: { type: "tool" as const, toolName: "finish" as const } } : {}),
      }),
      onStepFinish: async (step) => {
        turns++;
        usage.inputTokens += step.usage.inputTokens ?? 0;
        usage.outputTokens += step.usage.outputTokens ?? 0;
        spent += textCostUsd(pricing, step.usage) ?? 0;
        await options.onUsage?.(step.usage);
      },
    });
  } catch (err) {
    log.push(`error: ${err instanceof Error ? err.message : String(err)}`);
  }
  const stopped = accepted ? "finished" : spent >= maxCost ? "budget" : turns >= maxTurns ? "turns" : "gave-up";
  return { spec: accepted, turns, renders, usage, costUsd: spent, stopped, log };
}
