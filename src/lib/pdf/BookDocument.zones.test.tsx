import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { BookDocument } from "./BookDocument";
import { rasterizePdf } from "./rasterize";
import { placeholderImage, sampleContents } from "./__fixtures__/sample-book";
import { buildZonePlan } from "@/lib/design/zones";
import { resolvePageTemplate } from "@/lib/design/layouts";
import { resolveDesignTheme } from "@/lib/design/themes";
import { extraImageKey } from "@/lib/page-image";
import type { GeneratedPage, GeneratedUnit } from "@/lib/ai/schemas";
import type { SourcePageLayout } from "@/lib/source-layout";

// Faz B2/B3: pages laid out like their source pages (zone plans measured
// from a real coursebook's pages 13 and 17), with several pictures each.
// FIXTURE_OUT=<dir> writes the PDF and page PNGs for eyeballing.
const OUT = process.env.FIXTURE_OUT;

const measured = (images: SourcePageLayout["images"], textColumns: 1 | 2): SourcePageLayout => ({
  widthPt: 659,
  heightPt: 795,
  images,
  textColumns,
  wordCount: 400,
  exerciseCount: 5,
  itemCount: 14,
  exerciseRubrics: [],
  bodyFontPt: 10,
  headingFontPt: 13,
  zone: "two_column",
});

const exercise = (n: number, items: string[]) => ({
  kind: "practice" as const,
  heading: `${n} Complete the sentences.`,
  body: "Use the words from the box.",
  items,
  answerKey: items.map(() => "answer"),
});

const page13: GeneratedPage = {
  sourcePageNumber: 13,
  pageType: "content",
  unitNumber: 1,
  imagePrompt: "a bedroom",
  extraImagePrompts: ["a wardrobe", "a lamp", "a desk"],
  zonePlan: buildZonePlan(
    measured(
      [
        { x: 0.02, y: 0.43, w: 0.47, h: 0.25 },
        { x: 0.48, y: 0.4, w: 0.46, h: 0.23 },
        { x: 0.48, y: 0.68, w: 0.5, h: 0.23 },
        { x: 0.11, y: 0.83, w: 0.33, h: 0.13 },
      ],
      2,
    ),
  )!,
  blocks: [
    { kind: "narrative", heading: "Reading", body: "Sam has a new room. It is small but it is very bright. There is a big window next to the bed and a desk under the window." },
    exercise(1, ["Sam's room is ___ .", "The desk is under the ___ .", "The lamp is on the ___ ."]),
    exercise(2, ["bed", "wardrobe", "lamp", "desk"]),
    exercise(3, ["What colour is your room?", "Where is your bed?"]),
  ],
};

const page17: GeneratedPage = {
  sourcePageNumber: 17,
  pageType: "content",
  unitNumber: 1,
  imagePrompt: "children at a party",
  extraImagePrompts: ["a cake", "balloons", "a present"],
  zonePlan: buildZonePlan(
    measured(
      [
        { x: 0.52, y: 0.08, w: 0.41, h: 0.22 },
        { x: 0.05, y: 0.58, w: 0.44, h: 0.41 },
        { x: 0.5, y: 0.71, w: 0.45, h: 0.27 },
        { x: 0.5, y: 0.69, w: 0.16, h: 0.05 },
      ],
      2,
    ),
  )!,
  blocks: [
    { kind: "narrative", heading: "A party!", body: "Mia is having a birthday party on Saturday. She is inviting all her friends from school." },
    exercise(1, ["Mia is having a ___ .", "The party is on ___ ."]),
    exercise(2, ["Can you come to my party?", "What time does it start?"]),
    exercise(3, ["cake", "balloons", "present"]),
  ],
};

const unit: GeneratedUnit = { unitNumber: 1, title: "My World", glossary: [], workbookPages: [], studentBookPages: [page17, page13] };

describe("BookDocument source-zones pages", () => {
  it("lays pages out like their source pages, with every picture, on one sheet each", async () => {
    const pageImages: Record<number, string> = {};
    for (const p of [page13, page17]) {
      pageImages[p.sourcePageNumber] = await placeholderImage(`p${p.sourcePageNumber}`, p.sourcePageNumber * 20);
      for (const [i] of (p.extraImagePrompts ?? []).entries()) {
        pageImages[extraImageKey(p.sourcePageNumber, i + 1)] = await placeholderImage(`${i + 1}`, i * 70 + 30, 1024, 1024);
      }
    }
    const metrics = { width: 595.28, height: 841.89, bodySize: resolveDesignTheme("classic").bodySize };
    expect(resolvePageTemplate(page17, true, { pictureCount: 4, isUnitFirstPage: true, metrics })).toBe("source-zones");
    expect(resolvePageTemplate(page13, true, { pictureCount: 4, metrics })).toBe("source-zones");

    const buffer = await renderToBuffer(
      <BookDocument
        bookTitle="Open Streets"
        variant="student_book"
        units={[unit]}
        level="A2"
        contentsUnits={sampleContents}
        pageImages={pageImages}
        designTheme="classic"
        contentLanguage="en"
        includeCover={false}
      />,
    );
    const pages = await rasterizePdf(new Uint8Array(buffer), { dpi: OUT ? 70 : 20 });
    if (OUT) {
      mkdirSync(OUT, { recursive: true });
      writeFileSync(path.join(OUT, "zones.pdf"), buffer);
      for (const p of pages) writeFileSync(path.join(OUT, `zones-${p.pageNumber}.png`), p.png);
    }
    // imprint + contents + 2 zoned pages
    expect(pages.length).toBe(4);
  }, 60_000);

  it("prints the source's page furniture without pushing anything onto another page", async () => {
    const buffer = await renderToBuffer(
      <BookDocument
        bookTitle="Open Streets"
        variant="student_book"
        units={[unit]}
        level="A2"
        contentsUnits={sampleContents}
        designTheme="classic"
        contentLanguage="en"
        includeCover={false}
        sourceStyle={{
          dominantColors: ["#f15d52", "#ffe104", "#fbd6cd"],
          type: {
            headingFont: "sans",
            bodyFont: "sans",
            bodySizeRatio: null,
            furniture: {
              topBand: { color: "#ffdb00", heightRatio: 0.021, tab: { color: "#ef4a46", widthRatio: 0.48, heightRatio: 0.037 } },
              numberBadge: { color: "#ef4a46", filled: true },
              trackColor: "#c5d92c",
            },
          },
        }}
      />,
    );
    const pages = await rasterizePdf(new Uint8Array(buffer), { dpi: OUT ? 70 : 20 });
    if (OUT) for (const p of pages) writeFileSync(path.join(OUT, `zones-furniture-${p.pageNumber}.png`), p.png);
    expect(pages.length).toBe(4);
  }, 60_000);
});
