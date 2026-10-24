import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { GeneratedPage } from "@/lib/ai/schemas";
import type { PageLayoutSpec } from "@/lib/design/page-layout-spec";
import { renderToBuffer } from "@react-pdf/renderer";
import sharp from "sharp";
import { placeholderImage, sampleContents } from "./__fixtures__/sample-book";
import { BookDocument } from "./BookDocument";
import { extraImageKey } from "@/lib/page-image";
import { rasterizePdf } from "./rasterize";
import { measurePictures } from "./picture-info";
import { countPdfPages } from "./rasterize";
import { printedBlocks, renderSpecPage, specLook, specLookHints, type SpecPageContext } from "./spec-page";
import { TRIM_SIZES } from "./page-geometry";

// A page drawn from a design spec: on one sheet, every block printed, a
// region too small for its text reported as running over. FIXTURE_OUT=<dir>
// writes the PNG for eyeballing.
const OUT = process.env.FIXTURE_OUT;

const page: GeneratedPage = {
  sourcePageNumber: 2,
  pageType: "content",
  unitNumber: 0,
  imagePrompt: "four children waving",
  extraImagePrompts: ["a girl thinking"],
  blocks: [
    { kind: "practice", heading: "1 Listen and point", body: "Say the names.", items: ["Leo", "Amina", "Mei", "Sam"] },
    { kind: "practice", heading: "2 Ask and answer", body: "Ask a friend.", items: ["Hello!", "What's your name?"] },
    { kind: "reference", heading: "Teacher", body: "Sing every day.", callout: "tip" },
  ],
};

const spec: PageLayoutSpec = {
  version: 1,
  grounds: [{ box: { x: 0, y: 0.9, w: 1, h: 0.1 }, color: "#fde2d8" }],
  pictures: [
    { picture: 0, box: { x: 0.06, y: 0.1, w: 0.88, h: 0.38 } },
    { picture: 1, box: { x: 0, y: 0.56, w: 1, h: 0.32 }, bleed: true, badge: "2" },
  ],
  regions: [
    { box: { x: 0.06, y: 0.02, w: 0.88, h: 0.08 }, blocks: [0], textScale: 1.3 },
    { box: { x: 0.06, y: 0.49, w: 0.88, h: 0.06 }, blocks: [1], columns: 2, panel: { tint: "#fff6b3", border: "#e9c93d" } },
  ],
  headings: { style: "disc" },
  furniture: { footer: true },
};

async function context(): Promise<SpecPageContext> {
  const pictures = [await placeholderImage("scene", 30), await placeholderImage("photo", 200, 1024, 1024)];
  return {
    page,
    unit: { unitNumber: 0, title: "Hello" },
    pictures,
    look: specLook({ level: "CEFR Pre-A1", trimSize: "220x280", pictures: await measurePictures(pictures) }),
    pageSize: { width: TRIM_SIZES["220x280"].widthPt, height: TRIM_SIZES["220x280"].heightPt },
  };
}

async function pageText(pdf: Buffer): Promise<string> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(new Uint8Array(pdf), "application/pdf");
  const text = doc.loadPage(0).toStructuredText("preserve-whitespace").asText();
  doc.destroy();
  return text;
}

describe("printedBlocks", () => {
  it("keeps index for index with the page, nulls for what does not print", async () => {
    const ctx = await context();
    const blocks = printedBlocks(ctx);
    expect(blocks).toHaveLength(3);
    // a young learners' book prints no teacher tip box
    expect(blocks[2]).toBeNull();
    expect(blocks[0]?.heading).toBe("1 Listen and point");
  });
});

describe("renderSpecPage", () => {
  it("draws the page on one sheet with its text, and measures each region", async () => {
    const ctx = await context();
    const out = await renderSpecPage(spec, ctx);
    if (OUT) {
      mkdirSync(OUT, { recursive: true });
      writeFileSync(path.join(OUT, "spec-page.png"), out.png);
    }
    expect(await countPdfPages(new Uint8Array(out.pdf))).toBe(1);
    const text = await pageText(out.pdf);
    expect(text).toMatch(/Listen and point/);
    expect(text).toMatch(/What's your name\?/);
    expect(text).not.toMatch(/Sing every day/);
    expect(out.fits).toHaveLength(2);
    expect(out.fits[0].overflow).toBe(false);
    expect(out.fits[0].needed).toBeGreaterThan(10);
    // the panel is too short for its text: reported, padding counted
    expect(out.fits[1].overflow).toBe(true);
  }, 60_000);

  it("fits a region given room, in one column or two", async () => {
    const ctx = await context();
    const roomy = { ...spec, regions: [spec.regions[0], { ...spec.regions[1], box: { x: 0.06, y: 0.49, w: 0.88, h: 0.1 } }], pictures: [spec.pictures[0], { ...spec.pictures[1], box: { x: 0, y: 0.6, w: 1, h: 0.28 } }] };
    const out = await renderSpecPage(roomy, ctx);
    expect(out.fits.map((f) => f.overflow)).toEqual([false, false]);
    const narrow = await renderSpecPage({ ...roomy, regions: [roomy.regions[0], { ...roomy.regions[1], columns: 1 as const, box: { x: 0.06, y: 0.49, w: 0.2, h: 0.1 } }] }, ctx);
    expect(narrow.fits[1].needed).toBeGreaterThan(out.fits[1].needed);
  }, 60_000);

  it("gives look hints against a source page", async () => {
    const ctx = await context();
    const out = await renderSpecPage(spec, ctx);
    const blank = { palette: [1, ...new Array(15).fill(0)], colourfulness: 0, ink: 0, inkGrid: new Array(192).fill(0) };
    const hints = await specLookHints(out.png, { look: blank, images: [{ x: 0.06, y: 0.1, w: 0.88, h: 0.38 }] }, spec);
    expect(hints.pictureArea).toBeGreaterThan(0.3);
    expect(hints.ink).toBeLessThan(0.5);
  }, 60_000);
});

// The colour at a point of a page image (fractions of the page).
async function colourAt(png: Uint8Array, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(Buffer.from(png)).raw().toBuffer({ resolveWithObject: true });
  const i = (Math.round(y * (info.height - 1)) * info.width + Math.round(x * (info.width - 1))) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
}

describe("BookDocument with a stored design spec", () => {
  it("draws a page from its spec, and a page whose spec no longer fits by its template", async () => {
    const pageImages = { 2: await placeholderImage("scene", 30), [extraImageKey(2, 1)]: await placeholderImage("photo", 200, 1024, 1024) };
    // a ground no template prints: pale green over the page's lower tenth
    const designed = { ...page, designSpec: { ...spec, grounds: [{ box: { x: 0, y: 0.9, w: 1, h: 0.1 }, color: "#c8f0c8" }], regions: [spec.regions[0], { ...spec.regions[1], box: { x: 0.06, y: 0.49, w: 0.88, h: 0.06 } }] } };
    // the same spec on a page that has gained a block since
    const stale = { ...designed, sourcePageNumber: 3, blocks: [...page.blocks, { kind: "practice" as const, heading: "3 Draw", body: "Draw a friend." }] };
    const render = async (p: GeneratedPage) =>
      renderToBuffer(
        <BookDocument
          bookTitle="Spec"
          variant="student_book"
          units={[{ unitNumber: 0, title: "Hello", glossary: [], workbookPages: [], studentBookPages: [p] }]}
          level="CEFR Pre-A1"
          contentsUnits={sampleContents}
          pageImages={{ ...pageImages, 3: pageImages[2], [extraImageKey(3, 1)]: pageImages[extraImageKey(2, 1)] }}
          includeCover={false}
          trimSize="220x280"
        />,
      );
    const [, , drawn] = await rasterizePdf(new Uint8Array(await render(designed)), { dpi: 30 });
    expect(await colourAt(drawn.png, 0.3, 0.95)).toEqual([200, 240, 200]);
    const [, , fallback] = await rasterizePdf(new Uint8Array(await render(stale)), { dpi: 30 });
    expect(await colourAt(fallback.png, 0.3, 0.95)).not.toEqual([200, 240, 200]);
  }, 60_000);
});
