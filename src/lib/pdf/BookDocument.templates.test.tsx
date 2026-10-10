import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { BookDocument } from "./BookDocument";
import { DESIGN_THEME_IDS } from "@/lib/design/themes";
import { rasterizePdf } from "./rasterize";
import { placeholderImage, sampleContents, samplePageImages, sampleUnit } from "./__fixtures__/sample-book";

// Renders the fixture unit (every layout template) in every theme. Set
// FIXTURE_OUT=<dir> to also write each PDF and its page PNGs there for
// visual inspection, e.g. `FIXTURE_OUT=./tmp-fixtures npx vitest run BookDocument.templates`.
const OUT = process.env.FIXTURE_OUT;

describe("BookDocument layout templates", () => {
  for (const theme of DESIGN_THEME_IDS) {
    it(`renders every template in the "${theme}" theme`, async () => {
      const [pageImages, cover] = await Promise.all([samplePageImages(), placeholderImage("cover", 200, 1024, 1536)]);
      const buffer = await renderToBuffer(
        <BookDocument
          bookTitle="Open Streets"
          variant="student_book"
          units={[sampleUnit]}
          level="A2"
          contentsUnits={sampleContents}
          coverImageSrc={cover}
          pageImages={pageImages}
          designTheme={theme}
          contentLanguage="en"
        />,
      );
      expect(buffer.subarray(0, 4).toString()).toBe("%PDF");

      const pages = await rasterizePdf(new Uint8Array(buffer), { dpi: OUT ? 80 : 20 });
      if (OUT) {
        const dir = path.join(OUT, theme);
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, "book.pdf"), buffer);
        for (const p of pages) writeFileSync(path.join(dir, `page-${String(p.pageNumber).padStart(2, "0")}.png`), p.png);
      }
      // cover + imprint + contents + 9 template pages, none of which may
      // spill onto an extra page.
      expect(pages.length).toBe(12);

    }, 60_000);
  }
});
