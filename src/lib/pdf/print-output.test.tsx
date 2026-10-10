import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { BookDocument } from "./BookDocument";
import { CoverSpreadDocument, coverSpreadSize } from "./CoverSpreadDocument";
import { BLEED_PT, TRIM_SIZES, effectiveDpi, pixelsForPrint, spineWidthPt } from "./page-geometry";
import { countPdfPages, rasterizePdf } from "./rasterize";
import { placeholderImage, sampleContents, samplePageImages, sampleUnit } from "./__fixtures__/sample-book";

const OUT = process.env.FIXTURE_OUT;

describe("print geometry", () => {
  it("sizes the spine from the page count (KDP white paper, even pages)", () => {
    expect(spineWidthPt(100)).toBeCloseTo(100 * 0.002252 * 72, 5);
    expect(spineWidthPt(101)).toBeCloseTo(spineWidthPt(102), 5);
  });

  it("knows how many pixels a 300 DPI placement needs", () => {
    expect(pixelsForPrint(72 * 6)).toBe(1800);
    expect(effectiveDpi(1536, 507)).toBe(218);
  });

  it("builds a cover wrap of back + spine + front with bleed all round", () => {
    const size = coverSpreadSize("6x9", 120);
    expect(size.width).toBeCloseTo(432 * 2 + spineWidthPt(120) + 2 * BLEED_PT, 5);
    expect(size.height).toBeCloseTo(648 + 2 * BLEED_PT, 5);
  });
});

describe("print PDFs", () => {
  it("renders the interior with bleed and without the cover, same page flow as the screen PDF", async () => {
    const pageImages = await samplePageImages();
    const common = {
      bookTitle: "Open Streets",
      variant: "student_book" as const,
      units: [sampleUnit],
      level: "A2",
      contentsUnits: sampleContents,
      pageImages,
      designTheme: "modern-elt",
      contentLanguage: "en",
      trimSize: "6x9" as const,
    };
    const screen = await renderToBuffer(<BookDocument {...common} />);
    const print = await renderToBuffer(<BookDocument {...common} bleed={BLEED_PT} includeCover={false} />);
    const screenPages = await countPdfPages(new Uint8Array(screen));
    const printPages = await countPdfPages(new Uint8Array(print));
    expect(printPages).toBe(screenPages - 1);

    const [first] = await rasterizePdf(new Uint8Array(print), { dpi: 72, pages: [1] });
    expect(first.width).toBe(Math.round(TRIM_SIZES["6x9"].widthPt + 2 * BLEED_PT));

    const spread = await renderToBuffer(
      <CoverSpreadDocument
        bookTitle="Open Streets"
        variant="student_book"
        level="A2"
        unitTitles={["My Neighbourhood", "Food and Drink", "On Holiday"]}
        coverImageSrc={await placeholderImage("cover", 200, 1024, 1536)}
        isbn="9780306406157"
        trimSize="6x9"
        pageCount={printPages * 10}
        designTheme="modern-elt"
      />,
    );
    expect(await countPdfPages(new Uint8Array(spread))).toBe(1);

    if (OUT) {
      mkdirSync(OUT, { recursive: true });
      writeFileSync(path.join(OUT, "print-interior.pdf"), print);
      writeFileSync(path.join(OUT, "cover-spread.pdf"), spread);
      const [img] = await rasterizePdf(new Uint8Array(spread), { dpi: 60 });
      writeFileSync(path.join(OUT, "cover-spread.png"), img.png);
      for (const p of await rasterizePdf(new Uint8Array(print), { dpi: 60, pages: [3, 4] })) {
        writeFileSync(path.join(OUT, `print-page-${p.pageNumber}.png`), p.png);
      }
    }
  }, 60_000);
});
