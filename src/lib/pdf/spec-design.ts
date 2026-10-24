import type { DesignerInput } from "@/lib/design/agent-designer";
import type { SourcePageLayout } from "@/lib/source-layout";
import { pageBubbles } from "@/lib/ai/page-bubbles";
import { extraImageKey, resolvePageImageUrl } from "@/lib/page-image";
import type { PageLayoutSpec } from "@/lib/design/page-layout-spec";
import type { PageLook } from "@/lib/page-look";
import { designPage, type DesignRender, type DesignResult, type DesignerInput as Input, type DesignerOptions } from "@/lib/design/agent-designer";
import { measurePageLook } from "@/lib/page-look";
import { printedBlocks, renderSpecPage, specDesignable, specLookHints, type SpecPageContext, type SpecRender } from "./spec-page";
import sharp from "sharp";
import { tintGround, whiteGroundMask, type Rgb } from "./picture-ground";
import { measurePictures } from "./picture-info";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import type { SourceType } from "@/lib/design/source-theme";
import { audioTrackMap } from "@/lib/listening";
import { planLessons } from "@/lib/lesson-furniture";
import { resolvePageImageUrls } from "@/lib/page-image";
import { withUnitGlossary } from "@/lib/unit-glossary";
import { activityEmojis, loadEmojiIcons } from "./emoji-icons";
import { footerTopic } from "./BookDocument";
import { specLook } from "./spec-page";
import { TRIM_SIZES, type TrimSizeId } from "./page-geometry";

// The agent designer's view of one page (agent-designer.ts DesignerInput),
// from the page as the book prints it - shared by the workflow step and
// scripts/agent-designer.mts.

// What each of the page's pictures shows (its prompt), in the order
// resolvePageImageUrls lists them - a picture that failed is not listed.
function picturePrompts(ctx: Pick<SpecPageContext, "page" | "pictures">, pageImages?: Record<number, string>): (string | undefined)[] {
  const { page } = ctx;
  if (!pageImages) return [page.imagePrompt, ...(page.extraImagePrompts ?? [])].slice(0, ctx.pictures.length);
  const out: (string | undefined)[] = [];
  if (resolvePageImageUrl(page, pageImages)) out.push(page.imagePrompt);
  (page.extraImagePrompts ?? []).forEach((p, i) => {
    if (pageImages[extraImageKey(page.sourcePageNumber, i + 1)]) out.push(p);
  });
  return out;
}

export function designerInputFor(
  ctx: SpecPageContext & { topic?: string },
  source: { sourcePng: Uint8Array; sourceLayout: SourcePageLayout },
  pageImages?: Record<number, string>,
): DesignerInput | null {
  if (!specDesignable(ctx)) return null;
  const prompts = picturePrompts(ctx, pageImages);
  return {
    sourcePng: source.sourcePng,
    sourceLayout: source.sourceLayout,
    blocks: printedBlocks(ctx),
    pictures: ctx.pictures.map((src, i) => {
      const info = ctx.look.pictures?.[src];
      return { aspect: info?.aspect ?? null, object: !!info?.subject, ground: info?.ground, shows: prompts[i] };
    }),
    available: {
      topBand: !!ctx.look.furniture?.topBand,
      lessonTab: !!ctx.lesson?.tab,
      labels: ctx.page.labels?.length ?? 0,
      bubbles: pageBubbles(ctx.page).length,
      titleTab: ctx.topic,
    },
    page: { width: ctx.pageSize.width, height: ctx.pageSize.height, bodySize: ctx.look.theme.bodySize, youngLearners: !!ctx.look.wordList },
    colors: source.sourceLayout.designColors?.map((c) => c.hex),
    label: ctx.page.sectionLabel,
  };
}

const rgbOf = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;

async function load(src: string): Promise<Buffer | null> {
  const data = /^data:[^;]+;base64,(.*)$/.exec(src);
  if (data) return Buffer.from(data[1], "base64");
  try {
    const res = await fetch(src);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

// The picture with its white ground printed in exactly this colour (the
// designer matched it to a page ground), as a JPEG data URI; null when it
// has no white ground.
async function tintExactly(src: string, tint: Rgb): Promise<string | null> {
  const input = await load(src);
  if (!input) return null;
  try {
    const { data, info } = await sharp(input).flatten({ background: "#ffffff" }).raw().toBuffer({ resolveWithObject: true });
    const mask = whiteGroundMask(data, info.width, info.height, info.channels);
    if (!mask) return null;
    tintGround(data, mask, info.channels, tint);
    const out = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

// A spec picture box with a ground colour prints its picture's white
// ground in that colour (as picture-ground.ts tints the zoned pages'
// pictures, but in the colour asked): the page's pictures with those
// replaced, src for src.
export async function tintSpecPictures(spec: PageLayoutSpec, pictures: string[]): Promise<string[]> {
  const out = [...pictures];
  for (const p of spec.pictures) {
    const src = pictures[p.picture];
    if (!p.ground || !src) continue;
    const tinted = await tintExactly(src, rgbOf(p.ground));
    if (tinted) out[p.picture] = tinted;
  }
  return out;
}

// The page context with the spec's picture tints applied and the tinted
// pictures measured, as the book will print the page.
export async function withSpecTints<C extends SpecPageContext>(spec: PageLayoutSpec, ctx: C): Promise<C> {
  const pictures = await tintSpecPictures(spec, ctx.pictures);
  const fresh = pictures.filter((src, i) => src !== ctx.pictures[i]);
  if (!fresh.length) return ctx;
  return { ...ctx, pictures, look: { ...ctx.look, pictures: { ...ctx.look.pictures, ...(await measurePictures(fresh)) } } };
}

// renderSpecPage as the book will print the page (picture tints applied).
export async function renderDesign(spec: PageLayoutSpec, ctx: SpecPageContext & { topic?: string }, options?: { dpi?: number }): Promise<SpecRender> {
  return renderSpecPage(spec, await withSpecTints(spec, ctx), options);
}

// The designer's render tool: the page drawn, with look hints against the source.
export function designRenderer(ctx: SpecPageContext & { topic?: string }, source: { look: PageLook; images: SourcePageLayout["images"] }, onRender?: (render: SpecRender) => void) {
  return async (spec: PageLayoutSpec): Promise<DesignRender> => {
    const drawn = await renderDesign(spec, ctx);
    onRender?.(drawn);
    return { ...drawn, look: await specLookHints(drawn.png, source, spec) };
  };
}

// One mirrored page as the book prints it, ready for the designer or for
// renderSpecPage: its look (the book's theme in the source's type and
// colours, its pictures measured), pictures, lesson furniture and footer
// topic - as BookDocument works them out.
export async function bookSpecContext({
  units,
  unitNumber,
  pageIndex,
  field = "studentBookPages",
  pageImages,
  sourceType,
  dominantColors,
  designTheme,
  trimSize = "a4",
  level,
}: {
  units: GeneratedUnit[];
  unitNumber: number;
  pageIndex: number;
  field?: "studentBookPages" | "workbookPages";
  pageImages: Record<number, string>;
  sourceType?: SourceType | null;
  dominantColors?: string[] | null;
  designTheme?: string | null;
  trimSize?: TrimSizeId;
  level: string;
}): Promise<(SpecPageContext & { topic?: string }) | null> {
  const unit = units.find((u) => u.unitNumber === unitNumber);
  if (!unit) return null;
  const variant = field === "workbookPages" ? "workbook" : "student_book";
  const unitPages = withUnitGlossary(unit, unit[field] ?? [], variant);
  const page = unitPages[pageIndex];
  if (!page) return null;
  const pictures = resolvePageImageUrls(page, pageImages);
  const look = {
    ...specLook({
      designTheme,
      sourceType,
      dominantColors,
      trimSize,
      variant,
      level,
      pictures: await measurePictures(pictures),
      pictureSrc: await loadEmojiIcons(activityEmojis([unit])),
    }),
    tracks: audioTrackMap(units),
  };
  const lessonsOn = !!sourceType && !!look.furniture?.lessons;
  return {
    page,
    unit,
    pictures,
    look,
    pageSize: { width: TRIM_SIZES[trimSize].widthPt, height: TRIM_SIZES[trimSize].heightPt },
    lesson: lessonsOn ? planLessons(unitPages, unit)[pageIndex] : undefined,
    lessonsOn,
    topic: footerTopic(page.sectionLabel || unit.title),
  };
}

// The look of a page image (page-look.ts, at the width fidelity measures).
export async function pngLook(png: Uint8Array): Promise<PageLook> {
  const { data, info } = await sharp(Buffer.from(png)).resize({ width: 150 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return measurePageLook({ width: info.width, height: info.height, channels: info.channels, data });
}

// The designer on one page: its input from the page as printed and the
// source page (image and measured layout), the render tool drawing the
// page as the book will. Null when the page is not one the designer takes.
export async function designBookPage(
  ctx: SpecPageContext & { topic?: string },
  source: { png: Uint8Array; layout: SourcePageLayout; pageImages?: Record<number, string> },
  options: Omit<DesignerOptions, "render"> & { onRender?: (render: SpecRender) => void },
): Promise<{ input: Input; result: DesignResult } | null> {
  const input = designerInputFor(ctx, { sourcePng: source.png, sourceLayout: source.layout }, source.pageImages);
  if (!input) return null;
  const render = designRenderer(ctx, { look: await pngLook(source.png), images: source.layout.images }, options.onRender);
  return { input, result: await designPage(input, { ...options, render }) };
}
