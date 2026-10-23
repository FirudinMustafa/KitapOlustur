import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { BookDocument } from "./BookDocument";
import { rasterizePdf } from "./rasterize";
import { placeholderImage, sampleContents } from "./__fixtures__/sample-book";
import { extraImageKey } from "@/lib/page-image";
import type { GeneratedPage, GeneratedUnit } from "@/lib/ai/schemas";

// "Önce sayfa tasarımı": a scene, a card and a panel page (page-types.ts)
// in their type templates, each on one sheet. FIXTURE_OUT=<dir> writes the
// PDF and page PNGs for eyeballing.
const OUT = process.env.FIXTURE_OUT;

const shape = (pageType: "scene" | "cards" | "panels") => ({ exercises: 1, pictures: 1, pageType });

const scene: GeneratedPage = {
  sourcePageNumber: 1,
  pageType: "unit_opener",
  unitNumber: 1,
  imagePrompt: "a classroom",
  sourceShape: shape("scene"),
  blocks: [
    { kind: "practice", heading: "1 Listen, point and say", body: "Point. Say.", items: ["window", "door", "chair", "table", "book", "pencil"] },
    { kind: "practice", heading: "2 Listen and chant", body: "Do the actions!", items: ["Chair, chair, sit, sit, sit!", "Book, book, open, close!"] },
  ],
};

const cardWords = ["pencil", "book", "chair", "door", "red", "7"];
const cards: GeneratedPage = {
  sourcePageNumber: 2,
  pageType: "content",
  unitNumber: 1,
  imagePrompt: "two children at a table",
  extraImagePrompts: ["a pencil on white", "a book on white", "a chair on white", "a door on white"],
  sourceShape: shape("cards"),
  blocks: [
    { kind: "practice", heading: "1 Listen and point", body: "Say the words.", items: cardWords },
    { kind: "practice", heading: "2 Look and find", body: "Say.", items: ["the book", "the door"] },
  ],
};

const panels: GeneratedPage = {
  sourcePageNumber: 3,
  pageType: "content",
  unitNumber: 1,
  imagePrompt: "panel 1",
  extraImagePrompts: ["panel 2", "panel 3", "panel 4", "panel 5", "panel 6"],
  sourceShape: shape("panels"),
  blocks: [{ kind: "narrative", heading: "1 Watch and listen to the story", body: "Who says it?", items: ["Hello, Misty!", "I'm Leo.", "I'm Misty.", "Hello!", "I'm Aisha.", "Hello, friends!"] }],
};

const unit: GeneratedUnit = { unitNumber: 1, title: "My Classroom", glossary: [], workbookPages: [], studentBookPages: [scene, cards, panels] };

describe("BookDocument picture page types", () => {
  it("sets a scene, a card grid and a story-panel grid on one sheet each", async () => {
    const pageImages: Record<number, string> = {};
    for (const p of [scene, cards, panels]) {
      pageImages[p.sourcePageNumber] = await placeholderImage(`p${p.sourcePageNumber}`, p.sourcePageNumber * 40);
      for (const [i] of (p.extraImagePrompts ?? []).entries()) pageImages[extraImageKey(p.sourcePageNumber, i + 1)] = await placeholderImage(`${i + 2}`, i * 50 + 20, 1024, 1024);
    }
    const buffer = await renderToBuffer(
      <BookDocument
        bookTitle="Super Steps"
        variant="student_book"
        units={[unit]}
        level="CEFR Pre-A1"
        contentsUnits={sampleContents}
        pageImages={pageImages}
        designTheme="classic"
        contentLanguage="en"
        includeCover={false}
        sourceStyle={{
          dominantColors: ["#f15d52", "#ffe104", "#fbd6cd"],
          type: { headingFont: "sans", bodyFont: "sans", bodySizeRatio: null, furniture: { topBand: { color: "#ffdb00", heightRatio: 0.021, tab: { color: "#ef4a46", widthRatio: 0.48, heightRatio: 0.037 } } } },
        }}
      />,
    );
    const pages = await rasterizePdf(new Uint8Array(buffer), { dpi: OUT ? 70 : 20 });
    if (OUT) {
      mkdirSync(OUT, { recursive: true });
      writeFileSync(path.join(OUT, "types.pdf"), buffer);
      for (const p of pages) writeFileSync(path.join(OUT, `types-${p.pageNumber}.png`), p.png);
    }
    // imprint + contents + 3 typed pages
    expect(pages.length).toBe(5);
  }, 60_000);
});
