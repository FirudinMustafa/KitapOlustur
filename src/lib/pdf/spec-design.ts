import type { DesignerInput } from "@/lib/design/agent-designer";
import type { SourcePageLayout } from "@/lib/source-layout";
import { pageBubbles } from "@/lib/ai/page-bubbles";
import { extraImageKey, resolvePageImageUrl } from "@/lib/page-image";
import type { PageLayoutSpec } from "@/lib/design/page-layout-spec";
import type { PageLook } from "@/lib/page-look";
import type { DesignRender } from "@/lib/design/agent-designer";
import { printedBlocks, renderSpecPage, specLookHints, type SpecPageContext, type SpecRender } from "./spec-page";
import sharp from "sharp";
import { tintGround, whiteGroundMask, type Rgb } from "./picture-ground";
import { measurePictures } from "./picture-info";

// The agent designer's view of one page (agent-designer.ts DesignerInput),
// from the page as the book prints it - shared by the workflow step and
// scripts/agent-designer.mts.

// A page the designer can take over: not hand-positioned in Dizilim, and
// printing nothing a spec has no place for (a glossary grid).
export function specDesignable(ctx: Pick<SpecPageContext, "page" | "look">): boolean {
  const { page, look } = ctx;
  if (page.imageLayout || page.blocks.some((b) => b.layout)) return false;
  if (page.glossary?.length && !look.noGlossary) return false;
  return page.blocks.length > 0;
}

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

// renderSpecPage with the spec's picture tints applied (and the tinted
// pictures measured), as the book will print the page.
export async function renderDesign(spec: PageLayoutSpec, ctx: SpecPageContext & { topic?: string }, options?: { dpi?: number }): Promise<SpecRender> {
  const pictures = await tintSpecPictures(spec, ctx.pictures);
  const fresh = pictures.filter((src, i) => src !== ctx.pictures[i]);
  const look = fresh.length ? { ...ctx.look, pictures: { ...ctx.look.pictures, ...(await measurePictures(fresh)) } } : ctx.look;
  return renderSpecPage(spec, { ...ctx, pictures, look }, options);
}

// The designer's render tool: the page drawn, with look hints against the source.
export function designRenderer(ctx: SpecPageContext & { topic?: string }, source: { look: PageLook; images: SourcePageLayout["images"] }, onRender?: (render: SpecRender) => void) {
  return async (spec: PageLayoutSpec): Promise<DesignRender> => {
    const drawn = await renderDesign(spec, ctx);
    onRender?.(drawn);
    return { ...drawn, look: await specLookHints(drawn.png, source, spec) };
  };
}
