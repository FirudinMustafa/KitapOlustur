import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { BookDocument } from "./BookDocument";
import { countPdfPages, rasterizePdf } from "./rasterize";
import { placeholderImage } from "./__fixtures__/sample-book";
import type { GeneratedUnit } from "@/lib/ai/schemas";

const OUT = process.env.FIXTURE_OUT;

describe("picture book", () => {
  it("prints the story pages without coursebook furniture", async () => {
    const texts = [
      "Little Bear did not like the dark.",
      "Every night he hid under his blanket and counted to ten. One, two, three... it never helped.",
      "Then one night, a tiny star knocked on his window.",
    ];
    const unit: GeneratedUnit = {
      unitNumber: 1,
      title: "Little Bear and the Stars",
      workbookPages: [],
      glossary: [],
      studentBookPages: texts.map((text, i) => ({
        sourcePageNumber: 1000 + i,
        pageType: "content",
        unitNumber: 1,
        blocks: [{ kind: "narrative", heading: "", body: text }],
        imagePrompt: `scene ${i}`,
        layoutTemplate: "full-bleed-illustration",
      })),
    };
    const pageImages = Object.fromEntries(
      await Promise.all(texts.map(async (_, i) => [1000 + i, await placeholderImage(`scene ${i + 1}`, i * 90, 1024, 1536)] as const)),
    );
    const pdf = await renderToBuffer(
      <BookDocument
        bookTitle="Little Bear and the Stars"
        variant="student_book"
        units={[unit]}
        level="4-6 yaş"
        contentsUnits={[]}
        coverImageSrc={await placeholderImage("cover", 30, 1024, 1536)}
        pageImages={pageImages}
        designTheme="storybook"
        bookKind="picturebook"
        trimSize="7x10"
      />,
    );
    // cover + imprint + 3 story pages - no contents page
    expect(await countPdfPages(new Uint8Array(pdf))).toBe(5);

    if (OUT) {
      mkdirSync(OUT, { recursive: true });
      for (const p of await rasterizePdf(new Uint8Array(pdf), { dpi: 50 })) {
        writeFileSync(path.join(OUT, `pb-${p.pageNumber}.png`), p.png);
      }
    }
  }, 60_000);
});
